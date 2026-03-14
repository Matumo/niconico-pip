/**
 * PiP動画要素 poster変換ランタイムテストのシナリオ定義
 */

const pipVideoElementPosterTestScenarios = [
  "basic",
  "offlineFailure",
  "keyNormalizationCacheHit",
  "sharedPendingPromise",
  "retryAfterFailure",
  "outputIs16By9",
] as const;

type PipVideoElementPosterTestScenario = (typeof pipVideoElementPosterTestScenarios)[number];

const isPipVideoElementPosterTestScenario = (value: unknown): value is PipVideoElementPosterTestScenario =>
  typeof value === "string" &&
  (pipVideoElementPosterTestScenarios as readonly string[]).includes(value);

export {
  isPipVideoElementPosterTestScenario,
  pipVideoElementPosterTestScenarios,
};
export type { PipVideoElementPosterTestScenario };
