/**
 * htmlToPdfService.ts
 * ============================================================
 * Isolated, reusable HTML-to-PDF rendering service using
 * Puppeteer + Chromium.
 *
 * Scope: ONLY used for delegate purchasing PDF export.
 * Future reports may reuse this helper, but NO existing
 * exports have been migrated.
 *
 * Railway / Alpine Linux compatible:
 *   - Uses chromium from apk (installed via Dockerfile)
 *   - Safe container flags: --no-sandbox, --disable-setuid-sandbox
 *   - process.cwd() used for any path resolution (ESM-safe)
 * ============================================================
 */

import puppeteer from "puppeteer-core";

/** Chromium executable paths to try in order of preference */
const CHROMIUM_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,   // explicit env override
  "/usr/bin/chromium-browser",             // Alpine apk chromium
  "/usr/bin/chromium",                     // alternative Alpine path
  "/usr/bin/google-chrome",               // Debian/Ubuntu chrome
  "/usr/bin/google-chrome-stable",        // Debian stable
];

function resolveChromiumPath(): string {
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (candidate) return candidate;
  }
  throw new Error(
    "No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium."
  );
}

/**
 * Renders an HTML string to a PDF Buffer using Chromium.
 *
 * @param html  Full HTML document string (must include <html>, <head>, <body>)
 * @returns     PDF as a Buffer
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = resolveChromiumPath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();

    // ✅ الحل الجذري لمشكلة قص الصفحة من الجانب:
    // بدون هذا، Puppeteer يرسم الصفحة بعرض افتراضي 800px (viewport)، ثم يضغطها
    // داخل عرض A4 الأصغر عند التصدير — فيتجاوز المحتوى حدود الصفحة وينقطع من الجانب.
    // بضبط viewport بنفس عرض A4 الصافي (بعد طرح الهوامش)، يُرسم المحتوى من البداية
    // بالعرض الصحيح فلا يحدث أي تجاوز أو قص.
    // A4 = 210mm، الهامش 15mm يمين + 15mm يسار → العرض الصافي 180mm ≈ 680px عند 96dpi
    await page.setViewport({ width: 680, height: 960, deviceScaleFactor: 2 });

    // ✅ بدون هذا السطر، قواعد @media print في CSS (عرض الصفحة 210mm، تقسيم الصفحات،
    // منع قص الجداول والصور) لا تُطبَّق أبداً لأن Puppeteer يستخدم media type "screen"
    // افتراضياً — وهذا هو السبب الجذري لقص الصفحة من الجانب واختفاء بعض البيانات.
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
    await browser.close();
  }
}
