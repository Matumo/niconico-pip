/**
 * PiPレンダラーブラウザテストのシナリオ定義
 */

const pipRendererTestScenarios = [
  "empty",
  "narrowVideoOnly",
  "wideVideoOnly",
  "commentsOverlay",
  "commentsOnly",
  "videoAfterCommentsRemoved",
  "cleared",
] as const;

type PipRendererTestScenario = typeof pipRendererTestScenarios[number];

const pipRendererScenarioMarkerMap: Record<PipRendererTestScenario, string> = {
  empty: "pip-renderer-empty",
  narrowVideoOnly: "pip-renderer-narrow-video-only",
  wideVideoOnly: "pip-renderer-wide-video-only",
  commentsOverlay: "pip-renderer-comments-overlay",
  commentsOnly: "pip-renderer-comments-only",
  videoAfterCommentsRemoved: "pip-renderer-video-after-comments-removed",
  cleared: "pip-renderer-cleared",
};

const isPipRendererTestScenario = (value: unknown): value is PipRendererTestScenario =>
  typeof value === "string" && Object.hasOwn(pipRendererScenarioMarkerMap, value);

export { isPipRendererTestScenario, pipRendererScenarioMarkerMap, pipRendererTestScenarios };
export type { PipRendererTestScenario };
