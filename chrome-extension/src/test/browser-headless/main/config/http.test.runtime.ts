/**
 * http設定のランタイムテスト
 */
import { mergeHttpPolicy } from "@main/config/http";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const isNonNullNumber = (value: unknown): value is number =>
  typeof value === "number" && value >= 0;

const runTest = (): HeadlessBridgeDetails => {
  const policy = mergeHttpPolicy();

  const retryStatuses = policy.retry?.retryOnStatuses;
  const details: HeadlessBridgeDetails = {
    timeoutMs: isNonNullNumber(policy.timeoutMs),
    dedupe: policy.dedupe !== null && typeof policy.dedupe === "boolean",
    retry: policy.retry !== null && typeof policy.retry === "object",
    retryMaxAttempts: isNonNullNumber(policy.retry?.maxAttempts),
    retryBaseDelayMs: isNonNullNumber(policy.retry?.baseDelayMs),
    retryMaxDelayMs: isNonNullNumber(policy.retry?.maxDelayMs),
    retryJitterRatio: isNonNullNumber(policy.retry?.jitterRatio),
    retryOnStatuses: Array.isArray(retryStatuses)
      && retryStatuses.every((status) => typeof status === "number" && status >= 0),
    cache: policy.cache !== null && typeof policy.cache === "object",
    cacheEnabled: policy.cache.enabled !== null && typeof policy.cache.enabled === "boolean",
    cacheDefaultTtlMs: isNonNullNumber(policy.cache.defaultTtlMs),
    cacheMaxEntries: isNonNullNumber(policy.cache.maxEntries),
  };

  return details;
};

// エクスポート
export { runTest };
