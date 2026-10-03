import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/env", () => ({
  ENV: {
    deepSeekApiUrl: "https://deepseek.test",
    deepSeekApiKey: "test-key",
  },
}));

describe("DeepSeek request timeout", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aborts a hanging DeepSeek request at the caller timeout", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("../_core/llm");

    await expect(invokeLLM({
      timeoutMs: 25,
      messages: [{ role: "user", content: "test" }],
    })).rejects.toThrow("LLM request timed out after 25ms");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
  });
});

// Exercise completion/body, refresh and concurrent callers, not just /models.
describe("DeepSeek deadline coverage", () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const pendingUntilAbort = (signal?: AbortSignal | null) => new Promise<never>((_resolve, reject) => {
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const models = () => new Response(JSON.stringify({ data: [{ id: "deepseek-chat" }] }));
  const completion = () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));

  it.each(["completion", "body", "refresh"])("bounds %s with the same deadline", async phase => {
    const signals: Array<AbortSignal | null | undefined> = [];
    let gets = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (init?.method === "GET") {
        if (++gets === 1) return models();
        return pendingUntilAbort(init.signal);
      }
      if (phase === "refresh") return new Response("model not found", { status: 404 });
      if (phase === "body") return { ok: true, json: () => pendingUntilAbort(init?.signal) };
      return pendingUntilAbort(init?.signal);
    }));
    const { invokeLLM } = await import("../_core/llm");
    const request = invokeLLM({ timeoutMs: 50, messages: [{ role: "user", content: "test" }] });
    const check = expect(request).rejects.toThrow("LLM request timed out after 50ms");
    await vi.advanceTimersByTimeAsync(50);
    await check;
    expect(signals.length).toBe(phase === "refresh" ? 3 : 2);
    expect(signals.every(signal => signal === signals[0] && signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let one caller's cancellation poison another caller or future requests", async () => {
    let gets = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "GET" && ++gets === 1) return pendingUntilAbort(init.signal);
      return init?.method === "GET" ? models() : completion();
    }));
    const { invokeLLM } = await import("../_core/llm");
    const first = invokeLLM({ timeoutMs: 20, messages: [] });
    const check = expect(first).rejects.toThrow("timed out");
    await expect(invokeLLM({ timeoutMs: 100, messages: [] })).resolves.toMatchObject({ choices: expect.any(Array) });
    await vi.advanceTimersByTimeAsync(20);
    await check;
    await expect(invokeLLM({ timeoutMs: 100, messages: [] })).resolves.toMatchObject({ choices: expect.any(Array) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline on success and preserves calls without a deadline", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "GET" ? models() : completion()));
    const { invokeLLM } = await import("../_core/llm");
    await expect(invokeLLM({ timeoutMs: 50, messages: [] })).resolves.toMatchObject({ choices: expect.any(Array) });
    expect(vi.getTimerCount()).toBe(0);
    await expect(invokeLLM({ messages: [] })).resolves.toMatchObject({ choices: expect.any(Array) });
    expect(vi.getTimerCount()).toBe(0);
  });
});
