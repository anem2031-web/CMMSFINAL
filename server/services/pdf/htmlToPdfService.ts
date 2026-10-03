/**
 * htmlToPdfService.ts
 * ============================================================
 * Isolated, reusable HTML-to-PDF rendering service using
 * Puppeteer + Chromium.
 *
 * Railway / container safeguards:
 *   - One shared Chromium browser.
 *   - Bounded PDF concurrency with an in-process queue.
 *   - Browser recycling by job count / age.
 *   - Idle browser shutdown.
 *   - Hard cleanup before retrying after a Chromium failure.
 *   - Graceful Chromium cleanup on SIGTERM / SIGINT.
 *
 * No database state is involved here; this service only renders
 * HTML into a PDF Buffer.
 * ============================================================
 */

import puppeteer, { Browser } from "puppeteer-core";

/** Chromium executable paths to try in order of preference */
const CHROMIUM_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

function resolveChromiumPath(): string {
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (candidate) return candidate;
  }
  throw new Error(
    "No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium."
  );
}

function positiveIntFromEnv(name: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

const PDF_MAX_CONCURRENCY = positiveIntFromEnv("PDF_MAX_CONCURRENCY", 2, 8);
const PDF_MAX_QUEUE = positiveIntFromEnv("PDF_MAX_QUEUE", 50, 500);
const PDF_BROWSER_MAX_JOBS = positiveIntFromEnv("PDF_BROWSER_MAX_JOBS", 30, 500);
const PDF_BROWSER_MAX_AGE_MS = positiveIntFromEnv(
  "PDF_BROWSER_MAX_AGE_MS",
  30 * 60 * 1000,
  24 * 60 * 60 * 1000
);
const PDF_BROWSER_IDLE_MS = positiveIntFromEnv(
  "PDF_BROWSER_IDLE_MS",
  5 * 60 * 1000,
  60 * 60 * 1000
);
const PDF_BROWSER_CLOSE_TIMEOUT_MS = positiveIntFromEnv(
  "PDF_BROWSER_CLOSE_TIMEOUT_MS",
  10_000,
  60_000
);
const PDF_SHUTDOWN_TIMEOUT_MS = positiveIntFromEnv(
  "PDF_SHUTDOWN_TIMEOUT_MS",
  8_000,
  30_000
);

let sharedBrowser: Browser | null = null;
let launchingPromise: Promise<Browser> | null = null;
let browserMaintenancePromise: Promise<void> | null = null;
let browserStartedAt = 0;
let browserJobsSinceLaunch = 0;
let browserUsers = 0;
let browserUsersZeroWaiters: Array<() => void> = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

let activePdfJobs = 0;
let nextQueueId = 1;

type SlotRelease = () => Promise<void>;
type QueueWaiter = {
  id: number;
  enqueuedAt: number;
  resolve: (release: SlotRelease) => void;
  reject: (error: Error) => void;
};

const pdfQueue: QueueWaiter[] = [];

function browserAgeMs(): number {
  return browserStartedAt > 0 ? Date.now() - browserStartedAt : 0;
}

function logPdfManager(event: string, details?: Record<string, unknown>): void {
  const payload = {
    active: activePdfJobs,
    browserUsers,
    queued: pdfQueue.length,
    browserJobs: browserJobsSinceLaunch,
    browserAgeSec: Math.round(browserAgeMs() / 1000),
    ...(details ?? {}),
  };
  console.info(`[PDF Manager] ${event}`, payload);
}

function clearIdleTimer(): void {
  if (!idleTimer) return;
  clearTimeout(idleTimer);
  idleTimer = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = resolveChromiumPath();
  return puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  clearIdleTimer();

  if (browserMaintenancePromise) {
    await browserMaintenancePromise;
  }

  if (sharedBrowser?.connected) {
    return sharedBrowser;
  }

  if (launchingPromise) {
    return launchingPromise;
  }

  const launch = launchBrowser();
  launchingPromise = launch;

  try {
    const browser = await launch;
    sharedBrowser = browser;
    browserStartedAt = Date.now();
    browserJobsSinceLaunch = 0;

    browser.on("disconnected", () => {
      if (sharedBrowser === browser) {
        sharedBrowser = null;
        browserStartedAt = 0;
        browserJobsSinceLaunch = 0;
        logPdfManager("browser_disconnected");
      }
    });

    logPdfManager("browser_started", { pid: browser.process()?.pid ?? null });
    return browser;
  } finally {
    if (launchingPromise === launch) {
      launchingPromise = null;
    }
  }
}

function notifyBrowserUsersZero(): void {
  if (browserUsers !== 0) return;
  const waiters = browserUsersZeroWaiters;
  browserUsersZeroWaiters = [];
  for (const resolve of waiters) resolve();
}

async function waitForBrowserUsersZero(): Promise<void> {
  if (browserUsers === 0) return;
  await new Promise<void>(resolve => browserUsersZeroWaiters.push(resolve));
}

async function acquireBrowserForRender(): Promise<{ browser: Browser; release: () => void }> {
  // A maintenance/recycle request blocks new renderer users until the old
  // Chromium process is fully closed. Existing renderers are allowed to finish.
  while (browserMaintenancePromise) {
    await browserMaintenancePromise;
  }

  const browser = await getBrowser();

  // Maintenance could have been requested while getBrowser() was awaiting launch.
  // If so, let maintenance finish and acquire again from the fresh browser.
  if (browserMaintenancePromise) {
    await browserMaintenancePromise;
    return acquireBrowserForRender();
  }

  browserUsers += 1;
  let released = false;

  return {
    browser,
    release: () => {
      if (released) return;
      released = true;
      browserUsers = Math.max(0, browserUsers - 1);
      notifyBrowserUsersZero();
    },
  };
}

async function closeSharedBrowser(reason: string): Promise<void> {
  clearIdleTimer();

  let browser = sharedBrowser;
  if (!browser && launchingPromise) {
    try {
      browser = await launchingPromise;
    } catch {
      browser = null;
    }
  }

  if (!browser) {
    sharedBrowser = null;
    browserStartedAt = 0;
    browserJobsSinceLaunch = 0;
    return;
  }

  if (sharedBrowser === browser) {
    sharedBrowser = null;
  }

  const child = browser.process();
  logPdfManager("browser_closing", { reason, pid: child?.pid ?? null });

  try {
    await withTimeout(browser.close(), PDF_BROWSER_CLOSE_TIMEOUT_MS, "Chromium close");
  } catch (error: any) {
    console.warn(
      `[PDF Manager] Chromium did not close cleanly (${reason}); forcing process termination:`,
      error?.message || error
    );
    try {
      if (child && !child.killed) {
        child.kill("SIGKILL");
        await sleep(100);
      }
    } catch (killError: any) {
      console.warn("[PDF Manager] Failed to force-kill Chromium:", killError?.message || killError);
    }
  } finally {
    browserStartedAt = 0;
    browserJobsSinceLaunch = 0;
    logPdfManager("browser_closed", { reason });
  }
}

function shouldRecycleBrowser(): { recycle: boolean; reason?: string } {
  if (!sharedBrowser?.connected) return { recycle: false };
  if (browserJobsSinceLaunch >= PDF_BROWSER_MAX_JOBS) {
    return { recycle: true, reason: `job_limit:${browserJobsSinceLaunch}` };
  }
  if (browserAgeMs() >= PDF_BROWSER_MAX_AGE_MS) {
    return { recycle: true, reason: `age_limit:${Math.round(browserAgeMs() / 1000)}s` };
  }
  return { recycle: false };
}

function drainPdfQueue(): void {
  if (shuttingDown || browserMaintenancePromise) return;

  while (activePdfJobs < PDF_MAX_CONCURRENCY && pdfQueue.length > 0) {
    const waiter = pdfQueue.shift()!;
    activePdfJobs += 1;
    const waitedMs = Date.now() - waiter.enqueuedAt;
    if (waitedMs >= 1000) {
      logPdfManager("queue_released", { queueId: waiter.id, waitedMs });
    }
    waiter.resolve(createSlotRelease());
  }

  scheduleIdleCloseIfNeeded();
}

async function requestBrowserMaintenance(reason: string): Promise<void> {
  if (browserMaintenancePromise) {
    return browserMaintenancePromise;
  }

  clearIdleTimer();

  const maintenance = (async () => {
    logPdfManager("maintenance_started", { reason });
    await waitForBrowserUsersZero();
    await closeSharedBrowser(reason);
  })();

  browserMaintenancePromise = maintenance;

  try {
    await maintenance;
  } finally {
    if (browserMaintenancePromise === maintenance) {
      browserMaintenancePromise = null;
    }
    logPdfManager("maintenance_finished", { reason });
    drainPdfQueue();
  }
}

function scheduleIdleCloseIfNeeded(): void {
  if (
    shuttingDown ||
    idleTimer ||
    activePdfJobs !== 0 ||
    pdfQueue.length !== 0 ||
    browserMaintenancePromise ||
    !sharedBrowser?.connected
  ) {
    return;
  }

  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activePdfJobs === 0 && pdfQueue.length === 0 && sharedBrowser?.connected) {
      void requestBrowserMaintenance("idle_timeout");
    }
  }, PDF_BROWSER_IDLE_MS);
  idleTimer.unref?.();
}

function createSlotRelease(): SlotRelease {
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    activePdfJobs = Math.max(0, activePdfJobs - 1);

    const recycle = shouldRecycleBrowser();
    if (recycle.recycle && recycle.reason) {
      await requestBrowserMaintenance(recycle.reason);
    } else {
      drainPdfQueue();
    }
  };
}

async function acquirePdfSlot(): Promise<SlotRelease> {
  if (shuttingDown) {
    throw new Error("PDF service is shutting down; please retry shortly.");
  }

  clearIdleTimer();

  if (!browserMaintenancePromise && activePdfJobs < PDF_MAX_CONCURRENCY) {
    activePdfJobs += 1;
    return createSlotRelease();
  }

  if (pdfQueue.length >= PDF_MAX_QUEUE) {
    logPdfManager("queue_rejected", { maxQueue: PDF_MAX_QUEUE });
    throw new Error("PDF service is busy; please retry shortly.");
  }

  const queueId = nextQueueId++;
  return new Promise<SlotRelease>((resolve, reject) => {
    pdfQueue.push({ id: queueId, enqueuedAt: Date.now(), resolve, reject });
    logPdfManager("queued", { queueId });
  });
}

async function renderPdfAttempt(html: string): Promise<Buffer> {
  const { browser, release } = await acquireBrowserForRender();
  try {
    const page = await browser.newPage();
    try {
      // A4 = 210mm; 15mm margins on both sides => 180mm usable width ~= 680px at 96dpi.
      await page.setViewport({ width: 680, height: 960, deviceScaleFactor: 2 });
      await page.emulateMediaType("print");
      await page.setContent(html, { waitUntil: "load" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    release();
  }
}

/**
 * Renders an HTML string to a PDF Buffer using managed Chromium.
 *
 * At most PDF_MAX_CONCURRENCY render jobs run at once. Extra jobs wait in
 * memory rather than creating additional Chromium renderers. A failed render
 * gets one retry only, after the old browser process has been fully closed.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const releaseSlot = await acquirePdfSlot();
  let lastError: unknown;

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await renderPdfAttempt(html);
        browserJobsSinceLaunch += 1;
        return result;
      } catch (error: any) {
        lastError = error;
        console.error(`[PDF Export Error] Attempt ${attempt}:`, error?.message || error);

        if (attempt < 2 && !shuttingDown) {
          // Do not merely null the browser reference: fully close the old Chromium
          // process before retrying so orphan Chrome/Crashpad processes cannot pile up.
          await requestBrowserMaintenance(`render_error_attempt_${attempt}`);
        }
      }
    }

    throw lastError;
  } finally {
    await releaseSlot();
  }
}

async function waitForActiveJobsToFinish(maxWaitMs: number): Promise<void> {
  const startedAt = Date.now();
  while (activePdfJobs > 0 && Date.now() - startedAt < maxWaitMs) {
    await sleep(50);
  }
}

async function shutdownPdfManager(signal: "SIGTERM" | "SIGINT"): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  shuttingDown = true;
  clearIdleTimer();

  const pending = pdfQueue.splice(0, pdfQueue.length);
  for (const waiter of pending) {
    waiter.reject(new Error("PDF service is shutting down; please retry shortly."));
  }

  shutdownPromise = (async () => {
    logPdfManager("shutdown_started", { signal });
    await waitForActiveJobsToFinish(PDF_SHUTDOWN_TIMEOUT_MS);

    // At process shutdown it is preferable to terminate Chromium even if an in-flight
    // request did not finish within the grace window; Railway is stopping this process anyway.
    await closeSharedBrowser(`shutdown:${signal}`);
    logPdfManager("shutdown_finished", { signal });
  })();

  return shutdownPromise;
}

function installShutdownHandlers(): void {
  const install = (signal: "SIGTERM" | "SIGINT") => {
    process.once(signal, () => {
      void shutdownPdfManager(signal)
        .catch(error => {
          console.error(`[PDF Manager] ${signal} cleanup failed:`, error);
        })
        .finally(() => {
          process.exit(signal === "SIGINT" ? 130 : 0);
        });
    });
  };

  install("SIGTERM");
  install("SIGINT");
}

installShutdownHandlers();
