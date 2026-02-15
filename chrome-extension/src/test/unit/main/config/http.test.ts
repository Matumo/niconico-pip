/**
 * HTTP設定テスト
 */
import { describe, expect, test } from "vitest";
import { mergeHttpPolicy } from "@main/config/http";

describe("HTTP設定", () => {
  test("上書きなしで既定値を返すこと", () => {
    expect(mergeHttpPolicy()).toEqual({
      timeoutMs: 8000,
      dedupe: true,
      retry: {
        maxAttempts: 3,
        baseDelayMs: 250,
        maxDelayMs: 2000,
        jitterRatio: 0.2,
        retryOnStatuses: [408, 425, 429, 500, 502, 503, 504],
      },
      cache: {
        enabled: true,
        defaultTtlMs: 30_000,
        maxEntries: 100,
      },
    });
  });

  test("入れ子の上書きをマージすること", () => {
    const basePolicy = mergeHttpPolicy();
    const merged = mergeHttpPolicy({
      timeoutMs: 3000,
      retry: {
        maxAttempts: 5,
      },
      cache: {
        maxEntries: 10,
      },
    });

    expect(merged.timeoutMs).toBe(3000);
    expect(merged.retry.maxAttempts).toBe(5);
    expect(merged.retry.baseDelayMs).toBe(basePolicy.retry.baseDelayMs);
    expect(merged.cache.maxEntries).toBe(10);
    expect(merged.cache.defaultTtlMs).toBe(basePolicy.cache.defaultTtlMs);
  });
});
