/**
 * HTTPクライアントテスト
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HTTPError, TimeoutError as KyTimeoutError } from "ky";
import { mergeHttpPolicy } from "@main/config/http";
import {
  createTsSimpleLoggerMockHarness,
  type TsSimpleLoggerMockHarness,
} from "@test/unit/main/shared/logger";

let createHttpClient: typeof import("@main/platform/http/http-client").createHttpClient;
let loggerMockHarness: TsSimpleLoggerMockHarness;

describe("HTTPクライアント", () => {
  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createHttpClient } = await import("@main/platform/http/http-client"));
    loggerMockHarness.clearLoggerCalls();
  });

  test("requestでjsonヘルパーを利用できること", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );

    const client = createHttpClient({
      policy: mergeHttpPolicy(),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    const result = await client.request("https://test.localhost/request").json<{ ok: boolean }>();

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("各HTTPメソッドがkyへ委譲されること", async () => {
    const methods: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input instanceof Request) {
        methods.push(input.method);
      } else {
        methods.push(String(init?.method ?? "GET"));
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
    });

    const client = createHttpClient({
      policy: mergeHttpPolicy(),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    await client.get("https://test.localhost/get").json();
    await client.post("https://test.localhost/post", { json: { x: 1 } }).json();
    await client.put("https://test.localhost/put", { json: { x: 2 } }).json();
    await client.patch("https://test.localhost/patch", { json: { x: 3 } }).json();
    await client.delete("https://test.localhost/delete").json();
    await client.head("https://test.localhost/head");

    expect(methods).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
  });

  test("fetch未注入時にグローバルfetchを利用すること", async () => {
    const originalFetch = globalThis.fetch;
    const globalFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );
    globalThis.fetch = globalFetch as unknown as typeof fetch;

    try {
      const client = createHttpClient({
        policy: mergeHttpPolicy(),
      });

      const result = await client.request("https://test.localhost/global").json<{ ok: boolean }>();

      expect(result.ok).toBe(true);
      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("ポリシーに従ってリトライしbeforeRetryでログを出すこと", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
        }),
      );
    const client = createHttpClient({
      policy: mergeHttpPolicy({
        retry: {
          maxAttempts: 2,
          baseDelayMs: 1,
          maxDelayMs: 1,
          jitterRatio: 0,
        },
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    const result = await client.request("https://test.localhost/retry").json<{ ok: boolean }>();
    const httpLogger = loggerMockHarness.resolveMockLogger("http");

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(httpLogger.warn).toHaveBeenCalledTimes(1);
  });

  test("retryOnStatusesに含まれるステータスではリトライすること", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "busy" }), {
          status: 503,
          statusText: "Service Unavailable",
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
        }),
      );
    const client = createHttpClient({
      policy: mergeHttpPolicy({
        retry: {
          maxAttempts: 2,
          retryOnStatuses: [503],
          baseDelayMs: 1,
          maxDelayMs: 1,
          jitterRatio: 0,
        },
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    const result = await client.request("https://test.localhost/retry-on-status").json<{ ok: boolean }>();
    const httpLogger = loggerMockHarness.resolveMockLogger("http");

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(httpLogger.warn).toHaveBeenCalledTimes(1);
  });

  test("retryOnStatusesに含まれないステータスではリトライしないこと", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ message: "teapot" }), {
        status: 418,
        statusText: "I'm a teapot",
      }),
    );

    const client = createHttpClient({
      policy: mergeHttpPolicy({
        retry: {
          maxAttempts: 3,
          retryOnStatuses: [500],
        },
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    await expect(client.request("https://test.localhost/no-retry-on-status").json()).rejects.toBeInstanceOf(
      HTTPError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("バックオフ設定どおりの遅延でリトライすること", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("retry-1"))
      .mockRejectedValueOnce(new Error("retry-2"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
        }),
      );
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    try {
      const beforeCallCount = timeoutSpy.mock.calls.length;
      const client = createHttpClient({
        policy: mergeHttpPolicy({
          timeoutMs: 10_000,
          retry: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 20,
            jitterRatio: 0,
          },
        }),
        fetchFn: fetchFn as unknown as typeof fetch,
        randomFn: () => 0,
      });

      const result = await client.request("https://test.localhost/backoff").json<{ ok: boolean }>();
      expect(result.ok).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(3);

      const timeoutCalls = timeoutSpy.mock.calls.slice(beforeCallCount);
      const scheduledDelays = timeoutCalls.map(([, delay]) => Number(delay ?? 0));
      const retryDelays = scheduledDelays.filter((delay) => delay > 0 && delay <= 20);

      expect(retryDelays).toEqual([10, 20]);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  test("既定でHTTPErrorを投げリクエストごとに上書きできること", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ message: "bad" }), {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    const client = createHttpClient({
      policy: mergeHttpPolicy({
        retry: { maxAttempts: 1 },
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    await expect(client.request("https://test.localhost/http-error").json()).rejects.toBeInstanceOf(
      HTTPError,
    );

    const response = await client.request("https://test.localhost/no-throw", {
      throwHttpErrors: false,
    });
    expect(response.status).toBe(503);
  });

  test("タイムアウト時にkyのTimeoutErrorを返すこと", async () => {
    const fetchFn = vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const client = createHttpClient({
      policy: mergeHttpPolicy({
        timeoutMs: 1,
        retry: { maxAttempts: 1 },
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      randomFn: () => 0,
    });

    await expect(client.request("https://test.localhost/timeout").json()).rejects.toBeInstanceOf(
      KyTimeoutError,
    );
  });

  test("clear系メソッドがno-opであること", () => {
    const client = createHttpClient({
      policy: mergeHttpPolicy(),
      fetchFn: (async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
        })) as unknown as typeof fetch,
      randomFn: () => 0,
    });

    expect(() => client.clearInFlight()).not.toThrow();
    expect(() => client.clearCache()).not.toThrow();
  });
});
