/**
 * PiPストリーム
 */
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";

// PiPストリーム生成の入力型
interface CreatePipStreamOptions {
  pipVideoElement: HTMLVideoElement;
  renderFrame(drawContext: CanvasRenderingContext2D, drawCanvas: HTMLCanvasElement): boolean;
  canvasWidth: number;
  canvasHeight: number;
}

// PiPストリーム型
interface PipStream {
  start(): boolean;
  stop(): void;
  teardown(): void;
  isRunning(): boolean;
}

interface CanvasWith2dContext {
  canvasElement: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

type RenderFrameErrorLogger = (error: unknown) => void;

// captureStreamを持つcanvas型
type CaptureStreamCanvasElement = HTMLCanvasElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};

// canvas生成に必要な最小Document型
interface CanvasFactoryDocument {
  createElement(tagName: "canvas"): HTMLCanvasElement;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  document?: CanvasFactoryDocument;
  requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
  cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
};

const log = getLogger(appLoggerNames.media);
const renderFrameErrorLogCooldownMs = 10_000; // クールダウン期間（ミリ秒）

// play()のrejectがAbortErrorかどうかを判定する関数
const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

// クールダウン付き描画ループ失敗ロガーを作成する関数
const createRenderFrameErrorLogger = (message: string): RenderFrameErrorLogger => {
  let lastLoggedAt = -Infinity;
  let cooldownWarningLogged = false;

  return (error: unknown): void => {
    const now = performance.now();
    if (now - lastLoggedAt < renderFrameErrorLogCooldownMs) {
      if (!cooldownWarningLogged) {
        cooldownWarningLogged = true;
        log.warn(`${message} logs suppressed during cooldown`);
      }
      return;
    }

    lastLoggedAt = now;
    cooldownWarningLogged = false;
    log.warn(message, error);
  };
};
const logRenderFrameError = createRenderFrameErrorLogger("pip stream renderFrame failed");

// ストリームを停止する関数
const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

// 指定サイズのcanvasと2d contextを作成する関数
const createCanvasWith2dContext = (params: {
  canvasWidth: number;
  canvasHeight: number;
}): CanvasWith2dContext | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  const documentNode = browserGlobal.document;
  if (!documentNode || typeof documentNode.createElement !== "function") return null;

  const canvasElement = documentNode.createElement("canvas");
  if (!(canvasElement instanceof HTMLCanvasElement)) return null;

  canvasElement.width = params.canvasWidth;
  canvasElement.height = params.canvasHeight;

  const context = canvasElement.getContext("2d");
  if (!context) return null;

  return {
    canvasElement,
    context,
  };
};

// PiP待機用ダミーストリームを作成する関数
const createDummyStream = (params: {
  canvasWidth: number;
  canvasHeight: number;
}): MediaStream | null => {
  const renderSurface = createCanvasWith2dContext(params);
  if (!renderSurface) return null;

  const captureCanvas = renderSurface.canvasElement as CaptureStreamCanvasElement;
  if (typeof captureCanvas.captureStream !== "function") return null;

  // 画面クリア
  renderSurface.context.fillStyle = "black";
  renderSurface.context.fillRect(0, 0, captureCanvas.width, captureCanvas.height);

  // フレームレートは最低限に設定
  return captureCanvas.captureStream(1);
};

// PiPストリームを作成する関数
const createPipStream = (
  options: CreatePipStreamOptions,
): PipStream => {
  // ループ停止のログ出力関数
  const logDrawLoopStopped = (reason: string): void => {
    log.debug(`pip stream draw loop stopped (${reason})`);
  };

  // 合成描画していない間にセットするダミーstream
  let standbyStream = createDummyStream({
    canvasWidth: options.canvasWidth,
    canvasHeight: options.canvasHeight,
  });
  // 合成canvasから生成した本番stream
  let activeStream: MediaStream | null = null;

  // 合成描画先のcanvasとcontext
  let drawCanvas: HTMLCanvasElement | null = null;
  let drawContext: CanvasRenderingContext2D | null = null;

  // 予約済みフレームID
  let animationFrameId: number | null = null;
  // 合成描画ループが継続中かどうか
  let running = false;

  // 初期状態では待機用streamを接続しておく
  options.pipVideoElement.srcObject = standbyStream;

  // 描画ターゲットを必要時に初期化する関数
  const ensureRenderTarget = (): boolean => {
    if (drawCanvas && drawContext) return true;
    // 描画ターゲットを初期化
    const renderSurface = createCanvasWith2dContext({
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    });
    if (!renderSurface) return false;
    // 描画ターゲットを保存
    drawCanvas = renderSurface.canvasElement;
    drawContext = renderSurface.context;
    return true;
  };

  // 次フレームの描画を予約する関数
  const scheduleNextFrame = (): void => {
    const browserGlobal = globalThis as BrowserGlobal;
    // 必要な関数が存在しない場合はループを停止
    if (typeof browserGlobal.requestAnimationFrame !== "function") {
      logDrawLoopStopped("required function unavailable");
      return;
    }
    // ループ停止条件をチェック
    if (!running) {
      logDrawLoopStopped("running is false");
      return;
    }
    // 次フレームの描画を予約
    animationFrameId = browserGlobal.requestAnimationFrame(drawLoop);
  };

  // 合成描画ループを実行する関数
  const drawLoop = (): void => {
    // ループ停止条件をチェック
    if (!running || !drawCanvas || !drawContext) {
      logDrawLoopStopped("precondition not met");
      return;
    }
    // 描画処理の失敗はloop全体を止めず、次フレームを継続する
    try {
      options.renderFrame(drawContext, drawCanvas);
    } catch (error: unknown) {
      logRenderFrameError(error);
    }
    scheduleNextFrame();
  };

  return {
    start: (): boolean => {
      if (running) return true;
      // 描画ターゲットの準備
      if (!ensureRenderTarget() || !drawCanvas) return false;

      // 合成canvasのstreamへ切り替え
      const captureCanvas = drawCanvas as CaptureStreamCanvasElement;
      if (typeof captureCanvas.captureStream !== "function") return false;
      const stream = captureCanvas.captureStream();
      options.pipVideoElement.srcObject = stream;
      activeStream = stream;

      // 描画ループを開始
      running = true;
      drawLoop();
      void options.pipVideoElement.play()
        .then(() => {
          log.debug("pip stream play resolved");
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            log.debug("pip stream play rejected with AbortError", error);
            return;
          }
          log.warn("pip stream play rejected", error);
        });

      return true;
    },
    stop: (): void => {
      if (!running && activeStream === null) return;

      // 描画ループを停止
      if (animationFrameId !== null) {
        const browserGlobal = globalThis as BrowserGlobal;
        if (typeof browserGlobal.cancelAnimationFrame === "function") {
          logDrawLoopStopped("stop");
          browserGlobal.cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = null;
      }

      // ダミーstreamへ切り替え
      running = false;
      stopStream(activeStream);
      activeStream = null;
      options.pipVideoElement.pause();
      options.pipVideoElement.srcObject = standbyStream;
    },
    teardown: (): void => {
      stopStream(activeStream);
      activeStream = null;

      if (animationFrameId !== null) {
        const browserGlobal = globalThis as BrowserGlobal;
        if (typeof browserGlobal.cancelAnimationFrame === "function") {
          logDrawLoopStopped("teardown");
          browserGlobal.cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = null;
      }

      // 本番streamと待機用ダミーstreamの両方を破棄し、srcObjectを空に戻す
      running = false;
      stopStream(standbyStream);
      standbyStream = null;
      options.pipVideoElement.pause();
      options.pipVideoElement.srcObject = null;
    },
    isRunning: () => running,
  };
};

// エクスポート
export { createPipStream };
export type { CreatePipStreamOptions, PipStream };
