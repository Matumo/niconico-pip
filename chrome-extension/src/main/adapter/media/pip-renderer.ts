/**
 * PiPレンダラー
 *
 * WARNING: 高頻度で呼び出されるので効率を重視する。
 * - ログはクールダウン付きで出力して過剰に出ないようにする。
 * - 関数呼び出しの引数にparameter object patternを使用しない。
 *
 */
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";

// PiP描画元要素型
interface PipRendererSources {
  video: HTMLVideoElement | null;
  commentsCanvas: HTMLCanvasElement | null;
}

// PiPレンダラー型
interface PipRenderer {
  setSources(nextSources: PipRendererSources): void;
  drawFrame(drawContext: CanvasRenderingContext2D, drawCanvas: HTMLCanvasElement): boolean;
}

type DrawErrorLogger = (error: unknown) => void;

const log = getLogger(appLoggerNames.media);
const drawErrorLogCooldownMs = 10_000; // クールダウン期間（ミリ秒）

// クールダウン付き描画失敗ロガーを作成
const createDrawErrorLogger = (message: string): DrawErrorLogger => {
  let lastLoggedAt = -Infinity; // 最後にログを出した時刻
  let cooldownWarningLogged = false; // 抑制警告を出したかどうかのフラグ

  return (error: unknown): void => {
    const now = performance.now();
    if (now - lastLoggedAt < drawErrorLogCooldownMs) {
      // クールダウン中は1回だけログ抑制の警告を出す
      if (!cooldownWarningLogged) {
        cooldownWarningLogged = true;
        log.warn(`${message} logs suppressed during cooldown`);
      }
      return;
    }
    // クールダウン明けは通常ログを再開し、補足warn状態も戻す
    lastLoggedAt = now;
    cooldownWarningLogged = false;
    log.warn(message, error);
  };
};
const logVideoDrawError = createDrawErrorLogger("pip video drawImage failed");
const logCommentsDrawError = createDrawErrorLogger("pip comments drawImage failed");

// PiPのcanvas上の動画描画位置を計算する関数
const calculateVideoDrawPosition = (
  videoElement: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; width: number; height: number } => {
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  // 横長動画はcanvas幅に合わせ、上下に余白を残して中央配置する
  if (videoAspect > canvasAspect) {
    const width = canvasWidth;
    const height = canvasWidth / videoAspect;
    return {
      x: 0,
      y: (canvasHeight - height) / 2,
      width,
      height,
    };
  }

  // 縦長動画はcanvas高さに合わせ、左右に余白を残して中央配置する
  const height = canvasHeight;
  const width = canvasHeight * videoAspect;
  return {
    x: (canvasWidth - width) / 2,
    y: 0,
    width,
    height,
  };
};

// 動画をPiPのcanvasへ描画する関数
const drawVideoFrame = (
  drawContext: CanvasRenderingContext2D,
  drawCanvas: HTMLCanvasElement,
  videoElement: HTMLVideoElement | null,
): void => {
  if (!videoElement || videoElement.readyState < 2 ||
      videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
    return;
  }

  const pos = calculateVideoDrawPosition(videoElement, drawCanvas.width, drawCanvas.height);
  try {
    drawContext.drawImage(videoElement, pos.x, pos.y, pos.width, pos.height);
  } catch (error: unknown) {
    logVideoDrawError(error);
  }
};

// コメントcanvasをPiPのcanvasへ描画する関数
const drawCommentsFrame = (
  drawContext: CanvasRenderingContext2D,
  drawCanvas: HTMLCanvasElement,
  commentsCanvas: HTMLCanvasElement | null,
): void => {
  if (!commentsCanvas || commentsCanvas.width <= 0 || commentsCanvas.height <= 0) return;

  try {
    drawContext.drawImage(commentsCanvas, 0, 0, drawCanvas.width, drawCanvas.height);
  } catch (error: unknown) {
    logCommentsDrawError(error);
  }
};

// PiPレンダラーを作成する関数
const createPipRenderer = (): PipRenderer => {
  let sources: PipRendererSources = {
    video: null,
    commentsCanvas: null,
  };

  // フレームを描画する関数
  const drawFrame = (
    drawContext: CanvasRenderingContext2D,
    drawCanvas: HTMLCanvasElement,
  ): boolean => {
    // 画面クリア
    drawContext.fillStyle = "black";
    drawContext.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    // 描画ソースをレイヤー順に合成
    drawVideoFrame(drawContext, drawCanvas, sources.video);
    drawCommentsFrame(drawContext, drawCanvas, sources.commentsCanvas);
    return true;
  };

  return {
    setSources: (nextSources) => {
      sources = nextSources;
    },
    drawFrame,
  };
};

// エクスポート
export { createPipRenderer };
export type { PipRenderer, PipRendererSources };
