/**
 * PiPレンダラーのランタイムテスト
 */
import { createPipRenderer } from "@main/adapter/media/pip-renderer";
import {
  isPipRendererTestScenario,
  pipRendererScenarioMarkerMap,
  pipRendererTestScenarios,
  type PipRendererTestScenario,
} from "@test/browser-headless/main/adapter/media/pip-renderer.test-scenario";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VideoFixture {
  videoElement: HTMLVideoElement;
  stream: MediaStream;
}

// 合成結果を全ピクセル検査できるよう描画ソースは単色で固定
// - black: 背景、letterbox、pillarbox
// - red: 4:3 動画ソース
// - blue: 横長動画ソース
// - green: コメント canvas オーバーレイ
const black: RgbaColor = { r: 0, g: 0, b: 0 };
const red: RgbaColor = { r: 255, g: 0, b: 0 };
const blue: RgbaColor = { r: 0, g: 0, b: 255 };
const green: RgbaColor = { r: 0, g: 255, b: 0 };

const drawCanvasWidth = 128;
const drawCanvasHeight = 72;
const narrowVideoRect: Rect = {
  x: 16,
  y: 0,
  width: 96,
  height: 72,
};
const wideVideoRect: Rect = {
  x: 0,
  y: 4,
  width: 128,
  height: 64,
};

const waitForCondition = async (
  condition: () => boolean,
  timeoutMs = 1500,
): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 16));
  }
  return condition();
};

const isApproxColorAt = (
  pixels: Uint8ClampedArray,
  offset: number,
  expected: RgbaColor,
  tolerance = 20,
): boolean => {
  const alpha = expected.a ?? 255;
  return Math.abs(pixels[offset] - expected.r) <= tolerance &&
    Math.abs(pixels[offset + 1] - expected.g) <= tolerance &&
    Math.abs(pixels[offset + 2] - expected.b) <= tolerance &&
    Math.abs(pixels[offset + 3] - alpha) <= tolerance;
};

const readPixels = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): Uint8ClampedArray => context.getImageData(0, 0, canvas.width, canvas.height).data;

const createColorCanvas = (
  width: number,
  height: number,
  fillStyle: string,
): HTMLCanvasElement => {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new TypeError("2d context is unavailable");
  context.fillStyle = fillStyle;
  context.fillRect(0, 0, width, height);
  return canvas;
};

const startCanvasFramePump = (
  sourceCanvas: HTMLCanvasElement,
): (() => void) => {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new TypeError("2d context is unavailable");

  const pushFrame = (): void => {
    const frame = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    context.putImageData(frame, 0, 0);
  };

  pushFrame();
  const intervalId = globalThis.setInterval(pushFrame, 50);
  return () => globalThis.clearInterval(intervalId);
};

const createReadyVideoFromCanvas = async (
  sourceCanvas: HTMLCanvasElement,
): Promise<VideoFixture> => {
  const videoElement = globalThis.document.createElement("video");
  const stream = sourceCanvas.captureStream(30);
  const stopFramePump = startCanvasFramePump(sourceCanvas);
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.srcObject = stream;
  videoElement.style.position = "fixed";
  videoElement.style.left = "-10000px";
  videoElement.style.top = "-10000px";
  globalThis.document.body.appendChild(videoElement);
  void videoElement.play().catch(() => undefined);

  const ready = await waitForCondition(
    () => videoElement.readyState >= 2 &&
      videoElement.videoWidth === sourceCanvas.width &&
      videoElement.videoHeight === sourceCanvas.height,
  );
  stopFramePump();
  if (!ready) {
    throw new Error("stream-backed video element did not become ready");
  }

  return {
    videoElement,
    stream,
  };
};

const createNarrowVideoFixture = async (): Promise<VideoFixture> =>
  createReadyVideoFromCanvas(createColorCanvas(64, 48, "#ff0000"));

const createWideVideoFixture = async (): Promise<VideoFixture> =>
  createReadyVideoFromCanvas(createColorCanvas(128, 64, "#0000ff"));

const createCommentsCanvas = (): HTMLCanvasElement =>
  createColorCanvas(32, 18, "#00ff00");

const stopStream = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const cleanupVideoFixture = (fixture: VideoFixture | null): void => {
  if (!fixture) return;
  stopStream(fixture.stream);
  fixture.videoElement.remove();
};

const clearMountedRendererCanvas = (): void => {
  for (const scenario of pipRendererTestScenarios) {
    const marker = pipRendererScenarioMarkerMap[scenario];
    globalThis.document.querySelector(`[data-niconico-pip-marker="${marker}"]`)?.remove();
  }
};

const mountDrawCanvas = (
  drawCanvas: HTMLCanvasElement,
  scenario: PipRendererTestScenario,
): void => {
  clearMountedRendererCanvas();
  drawCanvas.dataset.niconicoPipMarker = pipRendererScenarioMarkerMap[scenario];
  if (!drawCanvas.isConnected) {
    globalThis.document.body.appendChild(drawCanvas);
  }
};

const isWithinRect = (x: number, y: number, rect: Rect): boolean =>
  x >= rect.x &&
  x < rect.x + rect.width &&
  y >= rect.y &&
  y < rect.y + rect.height;

const everyPixelMatches = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  expectedColorAt: (x: number, y: number) => RgbaColor,
  tolerance = 20,
): boolean => {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (!isApproxColorAt(pixels, offset, expectedColorAt(x, y), tolerance)) {
        return false;
      }
    }
  }
  return true;
};

const everyPixelMatchesSolidColor = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  color: RgbaColor,
): boolean => everyPixelMatches(pixels, width, height, () => color);

const everyPixelMatchesVideoLayout = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  videoRect: Rect,
  videoColor: RgbaColor,
): boolean => everyPixelMatches(
  pixels,
  width,
  height,
  (x, y) => isWithinRect(x, y, videoRect) ? videoColor : black,
);

const resolveScenario = (
  request: HeadlessBridgeRequest,
): PipRendererTestScenario | null => {
  const scenario = request.details?.scenario;
  return isPipRendererTestScenario(scenario) ? scenario : null;
};

const buildScenarioResult = (
  drawCanvas: HTMLCanvasElement,
  scenario: PipRendererTestScenario,
  scenarioDrawn: boolean,
  scenarioMatchesExpected: boolean,
): HeadlessBridgeDetails => {
  mountDrawCanvas(drawCanvas, scenario);
  return {
    requestedScenarioValid: true,
    drawContextAvailable: true,
    scenarioDrawn,
    scenarioMatchesExpected,
  };
};

const runTest = async (
  request: HeadlessBridgeRequest,
): Promise<HeadlessBridgeDetails> => {
  const scenario = resolveScenario(request);
  if (!scenario) {
    return {
      requestedScenarioValid: false,
    };
  }

  const renderer = createPipRenderer();
  const drawCanvas = globalThis.document.createElement("canvas");
  drawCanvas.width = drawCanvasWidth;
  drawCanvas.height = drawCanvasHeight;
  const drawContext = drawCanvas.getContext("2d", { willReadFrequently: true });
  if (!drawContext) {
    return {
      requestedScenarioValid: true,
      drawContextAvailable: false,
    };
  }

  let narrowVideo: VideoFixture | null = null;
  let wideVideo: VideoFixture | null = null;

  try {
    // 各scenarioを独立に実行し、検査したdrawCanvas自体をDOMに載せる構成
    // Playwrightのscreenshotと、ここで見ているピクセルを一致させる意図
    switch (scenario) {
      case "empty": {
        // 動画もコメントも渡さない場合の確認
        // 期待状態: 画面全体が黒
        renderer.setSources({
          video: null,
          commentsCanvas: null,
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesSolidColor(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          black,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "narrowVideoOnly": {
        // 4:3動画だけを描いたときの配置確認
        // 期待状態: 中央が赤、左右が黒帯
        narrowVideo = await createNarrowVideoFixture();
        renderer.setSources({
          video: narrowVideo.videoElement,
          commentsCanvas: null,
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesVideoLayout(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          narrowVideoRect,
          red,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "wideVideoOnly": {
        // 横長動画だけを描いたときの配置確認
        // 期待状態: 中央が青、上下が黒帯
        wideVideo = await createWideVideoFixture();
        renderer.setSources({
          video: wideVideo.videoElement,
          commentsCanvas: null,
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesVideoLayout(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          wideVideoRect,
          blue,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "commentsOverlay": {
        // 動画の上にコメントを重ねたときの合成順確認
        // 期待状態: 画面全体が緑で、下の青動画は見えない
        wideVideo = await createWideVideoFixture();
        renderer.setSources({
          video: wideVideo.videoElement,
          commentsCanvas: createCommentsCanvas(),
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesSolidColor(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          green,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "commentsOnly": {
        // コメントだけを描いたときの確認
        // 期待状態: 動画がなくても画面全体が緑
        renderer.setSources({
          video: null,
          commentsCanvas: createCommentsCanvas(),
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesSolidColor(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          green,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "videoAfterCommentsRemoved": {
        // 一旦コメントを描いたあとで動画表示へ戻したときの確認
        // 期待状態: 緑が残らず、赤の4:3動画表示に戻る
        narrowVideo = await createNarrowVideoFixture();
        renderer.setSources({
          video: null,
          commentsCanvas: createCommentsCanvas(),
        });
        renderer.drawFrame(drawContext, drawCanvas);
        renderer.setSources({
          video: narrowVideo.videoElement,
          commentsCanvas: null,
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesVideoLayout(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          narrowVideoRect,
          red,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }

      case "cleared": {
        // 一旦コメントを描いたあとで全ソースを外したときの確認
        // 期待状態: 緑が残らず、画面全体が黒に戻る
        renderer.setSources({
          video: null,
          commentsCanvas: createCommentsCanvas(),
        });
        renderer.drawFrame(drawContext, drawCanvas);
        renderer.setSources({
          video: null,
          commentsCanvas: null,
        });
        const scenarioDrawn = renderer.drawFrame(drawContext, drawCanvas);
        const scenarioMatchesExpected = everyPixelMatchesSolidColor(
          readPixels(drawContext, drawCanvas),
          drawCanvas.width,
          drawCanvas.height,
          black,
        );
        return buildScenarioResult(drawCanvas, scenario, scenarioDrawn, scenarioMatchesExpected);
      }
    }
  } finally {
    cleanupVideoFixture(narrowVideo);
    cleanupVideoFixture(wideVideo);
  }
};

export { runTest };
