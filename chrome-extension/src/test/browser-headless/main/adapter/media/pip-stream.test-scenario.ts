/**
 * PiPストリームランタイムテストのシナリオ定義
 */

const pipStreamTestScenarios = [
  "lifecycle",
  "renderFrameThrows",
] as const;

type PipStreamTestScenario = (typeof pipStreamTestScenarios)[number];

const isPipStreamTestScenario = (value: unknown): value is PipStreamTestScenario =>
  typeof value === "string" &&
  (pipStreamTestScenarios as readonly string[]).includes(value);

export { isPipStreamTestScenario, pipStreamTestScenarios };
export type { PipStreamTestScenario };
