/**
 * PiPストリームのランタイムテスト
 */
import { createPipStream } from "@main/adapter/media/pip-stream";
import {
  isPipStreamTestScenario,
  type PipStreamTestScenario,
} from "@test/browser-headless/main/adapter/media/pip-stream.test-scenario";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

interface PipStreamHarness {
  pipVideoElement: HTMLVideoElement;
  stream: ReturnType<typeof createPipStream>;
  getRenderFrameCallCount(): number;
  getLatestDrawCanvasWidth(): number;
  getLatestDrawCanvasHeight(): number;
}

interface ThrowingPipStreamHarness extends PipStreamHarness {
  getThrowCount(): number;
}

const waitForCondition = async (
  condition: () => boolean,
  timeoutMs = 1500,
): Promise<boolean> => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (condition()) return true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 16));
  }
  return condition();
};

const waitForSettle = async (timeMs = 250): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, timeMs));

const everyTrackStateIs = (
  stream: MediaStream | null,
  readyState: MediaStreamTrackState,
): boolean => stream instanceof MediaStream &&
  stream.getTracks().length > 0 &&
  stream.getTracks().every((track) => track.readyState === readyState);

const createPipVideoElement = (): HTMLVideoElement => {
  const pipVideoElement = globalThis.document.createElement("video");
  pipVideoElement.muted = true;
  pipVideoElement.autoplay = true;
  pipVideoElement.playsInline = true;
  pipVideoElement.style.position = "fixed";
  pipVideoElement.style.left = "-10000px";
  pipVideoElement.style.top = "-10000px";
  globalThis.document.body.appendChild(pipVideoElement);
  return pipVideoElement;
};

const resolveScenario = (request: HeadlessBridgeRequest): PipStreamTestScenario => {
  const scenario = request.details?.scenario;
  if (!isPipStreamTestScenario(scenario)) {
    throw new TypeError(`invalid pip-stream runtime test scenario: ${String(scenario)}`);
  }
  return scenario;
};

const assertNeverScenario = (scenario: never): never => {
  throw new TypeError(`unsupported pip-stream runtime test scenario: ${String(scenario)}`);
};

// 実ブラウザ上でPiPストリームを扱うための最小ハーネス
// renderFrameは赤/青を交互に塗り、描画ループが継続しているかを呼び出し回数で観測する
const createPipStreamHarness = (): PipStreamHarness => {
  const pipVideoElement = createPipVideoElement();
  let renderFrameCallCount = 0;
  let latestDrawCanvasWidth = 0;
  let latestDrawCanvasHeight = 0;
  const stream = createPipStream({
    pipVideoElement,
    renderFrame: (drawContext, drawCanvas) => {
      renderFrameCallCount += 1;
      latestDrawCanvasWidth = drawCanvas.width;
      latestDrawCanvasHeight = drawCanvas.height;
      drawContext.fillStyle = renderFrameCallCount % 2 === 0 ? "#0000ff" : "#ff0000";
      drawContext.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
      return true;
    },
    canvasWidth: 1280,
    canvasHeight: 720,
  });

  return {
    pipVideoElement,
    stream,
    getRenderFrameCallCount: () => renderFrameCallCount,
    getLatestDrawCanvasWidth: () => latestDrawCanvasWidth,
    getLatestDrawCanvasHeight: () => latestDrawCanvasHeight,
  };
};

// 最初のrenderFrameだけ例外にするfail-soft検証用ハーネス
const createThrowingPipStreamHarness = (): ThrowingPipStreamHarness => {
  const pipVideoElement = createPipVideoElement();
  let renderFrameCallCount = 0;
  let latestDrawCanvasWidth = 0;
  let latestDrawCanvasHeight = 0;
  let throwCount = 0;
  const stream = createPipStream({
    pipVideoElement,
    renderFrame: (drawContext, drawCanvas) => {
      renderFrameCallCount += 1;
      latestDrawCanvasWidth = drawCanvas.width;
      latestDrawCanvasHeight = drawCanvas.height;
      if (renderFrameCallCount === 1) {
        throwCount += 1;
        throw new Error("pip stream runtime test renderFrame failed intentionally");
      }
      drawContext.fillStyle = renderFrameCallCount % 2 === 0 ? "#00ff00" : "#0000ff";
      drawContext.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
      return true;
    },
    canvasWidth: 1280,
    canvasHeight: 720,
  });

  return {
    pipVideoElement,
    stream,
    getRenderFrameCallCount: () => renderFrameCallCount,
    getLatestDrawCanvasWidth: () => latestDrawCanvasWidth,
    getLatestDrawCanvasHeight: () => latestDrawCanvasHeight,
    getThrowCount: () => throwCount,
  };
};

const runLifecycleTest = async (): Promise<HeadlessBridgeDetails> => {
  // 開始前stopの安全性確認
  // 未開始時はno-opで、standby streamやrunning状態を壊さないことを見る
  const stopBeforeStartHarness = createPipStreamHarness();
  const stopBeforeStartStandbyStream = stopBeforeStartHarness.pipVideoElement.srcObject;
  stopBeforeStartHarness.stream.stop();
  const stopBeforeStartKeptStopped = stopBeforeStartHarness.stream.isRunning() === false;
  const stopBeforeStartKeptStandbyStream = stopBeforeStartHarness.pipVideoElement.srcObject ===
    stopBeforeStartStandbyStream;
  const stopBeforeStartKeptStandbyTracksLive = everyTrackStateIs(
    stopBeforeStartStandbyStream instanceof MediaStream ? stopBeforeStartStandbyStream : null,
    "live",
  );
  stopBeforeStartHarness.stream.teardown();
  stopBeforeStartHarness.pipVideoElement.remove();

  // 開始前teardownの確認
  // 未開始でもstandby streamを終了し、srcObjectをnullへ戻せることを見る
  const teardownBeforeStartHarness = createPipStreamHarness();
  const teardownBeforeStartStandbyStream = teardownBeforeStartHarness.pipVideoElement.srcObject;
  teardownBeforeStartHarness.stream.teardown();
  const teardownBeforeStartKeptStopped = teardownBeforeStartHarness.stream.isRunning() === false;
  const teardownBeforeStartEndedStandbyTracks = everyTrackStateIs(
    teardownBeforeStartStandbyStream instanceof MediaStream ? teardownBeforeStartStandbyStream : null,
    "ended",
  );
  const teardownBeforeStartClearedSrcObject =
    teardownBeforeStartHarness.pipVideoElement.srcObject === null;
  teardownBeforeStartHarness.pipVideoElement.remove();

  // 通常ライフサイクル確認の本体
  const mainHarness = createPipStreamHarness();
  const { pipVideoElement, stream } = mainHarness;

  // 生成直後のstandby stream確認
  const standbyStream = pipVideoElement.srcObject;
  const standbyStreamInitialized = standbyStream instanceof MediaStream;
  const standbyStreamTracksLiveBeforeStart = everyTrackStateIs(
    standbyStream instanceof MediaStream ? standbyStream : null,
    "live",
  );

  // start直後の確認
  // active streamへの切り替え、描画ループ開始、play開始、設定サイズでの描画を確認する
  const startReturnedTrue = stream.start();
  const renderFrameRanAfterStart = await waitForCondition(
    () => mainHarness.getRenderFrameCallCount() >= 2,
  );
  const playStartedAfterStart = await waitForCondition(() => pipVideoElement.paused === false);
  await waitForSettle();
  const activeStream = pipVideoElement.srcObject;
  const activeStreamSwitched = activeStream instanceof MediaStream &&
    activeStream !== standbyStream;
  const activeStreamTracksLiveAfterStart = everyTrackStateIs(
    activeStream instanceof MediaStream ? activeStream : null,
    "live",
  );
  const runningAfterStart = stream.isRunning() === true;
  const renderFrameReceivedConfiguredCanvasSize =
    mainHarness.getLatestDrawCanvasWidth() === 1280 &&
    mainHarness.getLatestDrawCanvasHeight() === 720;

  // 実行中の二重start確認
  // trueは返すが、active streamは差し替えず既存実行を維持することを見る
  const startReturnedTrueWhileRunning = stream.start();
  await waitForSettle();
  const activeStreamPreservedOnSecondStart = pipVideoElement.srcObject === activeStream;

  // stop後の確認
  // active stream終了、standby復帰、描画停止を確認する
  const renderFrameCallCountBeforeStop = mainHarness.getRenderFrameCallCount();
  stream.stop();
  const runningAfterStop = stream.isRunning() === false;
  const activeStreamTracksEndedAfterStop = everyTrackStateIs(
    activeStream instanceof MediaStream ? activeStream : null,
    "ended",
  );
  const standbyRestoredAfterStop = pipVideoElement.srcObject === standbyStream;
  const standbyStreamTracksStillLiveAfterStop = everyTrackStateIs(
    standbyStream instanceof MediaStream ? standbyStream : null,
    "live",
  );
  await waitForSettle();
  const renderFrameStoppedAfterStop =
    mainHarness.getRenderFrameCallCount() === renderFrameCallCountBeforeStop;

  // restart後の確認
  // freshなactive streamへ切り替わり、再び描画とplayが始まることを見る
  const restartReturnedTrue = stream.start();
  const renderFrameRanAfterRestart = await waitForCondition(
    () => mainHarness.getRenderFrameCallCount() >= renderFrameCallCountBeforeStop + 1,
  );
  const playStartedAfterRestart = await waitForCondition(() => pipVideoElement.paused === false);
  await waitForSettle();
  const restartedActiveStream = pipVideoElement.srcObject;
  const restartedWithFreshActiveStream = restartedActiveStream instanceof MediaStream &&
    restartedActiveStream !== standbyStream &&
    restartedActiveStream !== activeStream;
  const restartedActiveStreamTracksLiveAfterRestart = everyTrackStateIs(
    restartedActiveStream instanceof MediaStream ? restartedActiveStream : null,
    "live",
  );

  // teardown後の確認
  // active/standby両方の終了、srcObject解除、描画停止を確認する
  const renderFrameCallCountBeforeTeardown = mainHarness.getRenderFrameCallCount();
  stream.teardown();
  const runningAfterTeardown = stream.isRunning() === false;
  const restartedActiveStreamTracksEndedAfterTeardown = everyTrackStateIs(
    restartedActiveStream instanceof MediaStream ? restartedActiveStream : null,
    "ended",
  );
  const standbyStreamTracksEndedAfterTeardown = everyTrackStateIs(
    standbyStream instanceof MediaStream ? standbyStream : null,
    "ended",
  );
  const srcObjectClearedAfterTeardown = pipVideoElement.srcObject === null;
  await waitForSettle();
  const renderFrameStoppedAfterTeardown =
    mainHarness.getRenderFrameCallCount() === renderFrameCallCountBeforeTeardown;

  pipVideoElement.remove();

  return {
    stopBeforeStartKeptStopped,
    stopBeforeStartKeptStandbyStream,
    stopBeforeStartKeptStandbyTracksLive,
    teardownBeforeStartKeptStopped,
    teardownBeforeStartEndedStandbyTracks,
    teardownBeforeStartClearedSrcObject,
    standbyStreamInitialized,
    standbyStreamTracksLiveBeforeStart,
    startReturnedTrue,
    renderFrameRanAfterStart,
    playStartedAfterStart,
    activeStreamSwitched,
    activeStreamTracksLiveAfterStart,
    runningAfterStart,
    renderFrameReceivedConfiguredCanvasSize,
    startReturnedTrueWhileRunning,
    activeStreamPreservedOnSecondStart,
    runningAfterStop,
    activeStreamTracksEndedAfterStop,
    standbyRestoredAfterStop,
    standbyStreamTracksStillLiveAfterStop,
    renderFrameStoppedAfterStop,
    restartReturnedTrue,
    renderFrameRanAfterRestart,
    playStartedAfterRestart,
    restartedWithFreshActiveStream,
    restartedActiveStreamTracksLiveAfterRestart,
    runningAfterTeardown,
    restartedActiveStreamTracksEndedAfterTeardown,
    standbyStreamTracksEndedAfterTeardown,
    srcObjectClearedAfterTeardown,
    renderFrameStoppedAfterTeardown,
  };
};

const runRenderFrameThrowsTest = async (): Promise<HeadlessBridgeDetails> => {
  const harness = createThrowingPipStreamHarness();
  const { pipVideoElement, stream } = harness;

  const standbyStream = pipVideoElement.srcObject;
  const standbyStreamInitialized = standbyStream instanceof MediaStream;
  const startReturnedTrue = stream.start();
  const renderFrameThrewOnce = await waitForCondition(() => harness.getThrowCount() === 1);
  const renderFrameContinuedAfterThrow = await waitForCondition(
    () => harness.getRenderFrameCallCount() >= 2,
  );
  const playStartedAfterThrow = await waitForCondition(() => pipVideoElement.paused === false);
  await waitForSettle();

  const activeStream = pipVideoElement.srcObject;
  const activeStreamSwitched = activeStream instanceof MediaStream && activeStream !== standbyStream;
  const activeStreamTracksLiveAfterThrow = everyTrackStateIs(
    activeStream instanceof MediaStream ? activeStream : null,
    "live",
  );
  const runningAfterThrow = stream.isRunning() === true;
  const renderFrameReceivedConfiguredCanvasSize =
    harness.getLatestDrawCanvasWidth() === 1280 &&
    harness.getLatestDrawCanvasHeight() === 720;

  stream.teardown();
  const runningAfterTeardown = stream.isRunning() === false;
  const activeStreamTracksEndedAfterTeardown = everyTrackStateIs(
    activeStream instanceof MediaStream ? activeStream : null,
    "ended",
  );
  const standbyStreamTracksEndedAfterTeardown = everyTrackStateIs(
    standbyStream instanceof MediaStream ? standbyStream : null,
    "ended",
  );
  const srcObjectClearedAfterTeardown = pipVideoElement.srcObject === null;

  pipVideoElement.remove();

  return {
    standbyStreamInitialized,
    startReturnedTrue,
    renderFrameThrewOnce,
    renderFrameContinuedAfterThrow,
    playStartedAfterThrow,
    activeStreamSwitched,
    activeStreamTracksLiveAfterThrow,
    runningAfterThrow,
    renderFrameReceivedConfiguredCanvasSize,
    runningAfterTeardown,
    activeStreamTracksEndedAfterTeardown,
    standbyStreamTracksEndedAfterTeardown,
    srcObjectClearedAfterTeardown,
  };
};

const runTest = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  const scenario = resolveScenario(request);
  switch (scenario) {
    case "lifecycle":
      return runLifecycleTest();
    case "renderFrameThrows":
      return runRenderFrameThrowsTest();
    default:
      return assertNeverScenario(scenario);
  }
};

export { runTest };
