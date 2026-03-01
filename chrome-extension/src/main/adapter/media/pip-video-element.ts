/**
 * PiP動画要素アダプター
 */
import { waitForLoadedMetadata } from "@main/adapter/media/pip-video-element-loaded-metadata";
import { makePoster16By9 } from "@main/adapter/media/pip-video-element-poster";
import { calculatePipVideoElementSize } from "@main/adapter/media/pip-video-element-size";

// PiP動画要素アダプター生成の入力型
interface CreatePipVideoElementAdapterOptions {
  elementId: string;
  canvasWidth: number;
  canvasHeight: number;
}

// PiP動画要素アダプター型
interface PipVideoElementAdapter {
  getElement(): HTMLVideoElement;
  ensureInserted(target: HTMLDivElement): boolean;
  updateSize(): boolean;
  updatePoster(thumbnailUrl: string | null): Promise<boolean>;
  requestPictureInPicture(): Promise<boolean>;
  isOwnPictureInPictureElement(eventTarget?: EventTarget | null): boolean;
  stop(): void;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  document?: Document;
  ResizeObserver?: typeof ResizeObserver;
};

// captureStreamを持つcanvas型
type CaptureStreamCanvasElement = HTMLCanvasElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};

// requestPictureInPictureを持つvideo型
type PictureInPictureCapableVideoElement = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
};

// documentの取得結果型
type DocumentLike = Pick<Document, "createElement" | "getElementById" | "pictureInPictureElement">;

// documentを取得する関数
const resolveDocument = (): DocumentLike => {
  const browserGlobal = globalThis as BrowserGlobal;
  const documentNode = browserGlobal.document;
  if (!documentNode || typeof documentNode.createElement !== "function" ||
      typeof documentNode.getElementById !== "function") {
    throw new TypeError("document is unavailable for pip video element adapter");
  }
  return documentNode;
};

// video要素を初期化する関数
const createPipVideoElement = (params: {
  elementId: string;
  documentNode: DocumentLike;
}): HTMLVideoElement => {
  const pipVideoElement = params.documentNode.createElement("video");
  if (!(pipVideoElement instanceof HTMLVideoElement)) {
    throw new TypeError("video element creation failed for pip video element adapter");
  }

  pipVideoElement.id = params.elementId;
  pipVideoElement.muted = true;
  pipVideoElement.autoplay = true;
  pipVideoElement.loop = true;
  pipVideoElement.hidden = true;
  return pipVideoElement;
};

// ストリームを停止する関数
const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

// PiP用ダミーストリームを作成する関数
const createDummyStream = (params: {
  documentNode: DocumentLike;
  canvasWidth: number;
  canvasHeight: number;
}): MediaStream | null => {
  const canvasElement = params.documentNode.createElement("canvas");
  if (!(canvasElement instanceof HTMLCanvasElement)) return null;

  const captureCanvas = canvasElement as CaptureStreamCanvasElement;
  if (typeof captureCanvas.captureStream !== "function") return null;

  canvasElement.width = params.canvasWidth;
  canvasElement.height = params.canvasHeight;

  const context = canvasElement.getContext("2d");
  if (!context) return null;

  context.fillStyle = "black";
  context.fillRect(0, 0, canvasElement.width, canvasElement.height);
  return captureCanvas.captureStream(1);
};

// PiP動画要素アダプターを作成する関数
const createPipVideoElementAdapter = (
  options: CreatePipVideoElementAdapterOptions,
): PipVideoElementAdapter => {
  const documentNode = resolveDocument();
  const pipVideoElement = createPipVideoElement({
    elementId: options.elementId,
    documentNode,
  });
  const pictureInPictureCapableVideoElement = pipVideoElement as PictureInPictureCapableVideoElement;

  let currentStream: MediaStream | null = null;
  let sizeObserver: ResizeObserver | null = null;

  // PiP動画要素へストリームを設定する関数
  const setSourceStream = (nextStream: MediaStream | null): void => {
    if (currentStream === nextStream) return;
    stopStream(currentStream);
    currentStream = nextStream;
    pipVideoElement.srcObject = nextStream;
  };

  // PiP動画要素サイズを更新する関数
  const updateSize = (): boolean => {
    const parentElement = pipVideoElement.parentElement;
    if (!parentElement) return false;

    // NOTE: サイズを親要素に合わせる
    const rect = parentElement.getBoundingClientRect();
    const size = calculatePipVideoElementSize({
      parentWidth: rect.width,
      parentHeight: rect.height,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    });

    pipVideoElement.style.width = `${size.width}px`;
    pipVideoElement.style.height = `${size.height}px`;
    return true;
  };

  // PiP動画の親要素のサイズ変更監視を開始する関数
  const observeSize = (): boolean => {
    if (sizeObserver) {
      sizeObserver.disconnect();
      sizeObserver = null;
    }

    const parentElement = pipVideoElement.parentElement;
    if (!parentElement) return false;

    const browserGlobal = globalThis as BrowserGlobal;
    const ResizeObserverCtor = browserGlobal.ResizeObserver;
    if (typeof ResizeObserverCtor !== "function") return false;

    sizeObserver = new ResizeObserverCtor(() => {
      updateSize();
    });
    sizeObserver.observe(parentElement);
    return true;
  };

  // PiP動画要素が自分自身で有効か判定する関数
  const isOwnPictureInPictureElement = (eventTarget?: EventTarget | null): boolean => {
    if (eventTarget instanceof HTMLVideoElement) return eventTarget === pipVideoElement;
    return documentNode.pictureInPictureElement === pipVideoElement;
  };

  // PiP動画要素を挿入する関数
  const ensureInserted = (target: HTMLDivElement): boolean => {
    if (!target.parentElement) return false;

    // 同じidの要素が既にある場合は、自分自身かどうかで処理を分ける
    const existingElement = documentNode.getElementById(pipVideoElement.id);
    if (existingElement === pipVideoElement) return true;
    if (existingElement) existingElement.remove();

    target.insertBefore(pipVideoElement, target.firstChild);
    updateSize();
    observeSize();
    return true;
  };

  // PiP動画要素のposterを更新する関数
  const updatePoster = async (thumbnailUrl: string | null): Promise<boolean> => {
    if (!thumbnailUrl) {
      pipVideoElement.removeAttribute("poster");
      return false;
    }

    try {
      const posterDataUrl = await makePoster16By9(thumbnailUrl, documentNode);
      pipVideoElement.setAttribute("poster", posterDataUrl);
    } catch {
      pipVideoElement.setAttribute("poster", thumbnailUrl);
    }
    return true;
  };

  // PiPを要求する関数
  const requestPictureInPicture = async (): Promise<boolean> => {
    if (typeof pictureInPictureCapableVideoElement.requestPictureInPicture !== "function") {
      return false;
    }

    const loaded = await waitForLoadedMetadata(pipVideoElement);
    if (!loaded) return false;

    try {
      await pictureInPictureCapableVideoElement.requestPictureInPicture();
      return true;
    } catch {
      return false;
    }
  };

  // アダプターを停止する関数
  const stop = (): void => {
    if (sizeObserver) {
      sizeObserver.disconnect();
      sizeObserver = null;
    }
    setSourceStream(null);

    // 再初期化時に重複要素が残らないよう、DOMから要素を外す
    if (pipVideoElement.parentElement) {
      pipVideoElement.remove();
    }
  };

  // 初期ダミーストリームを設定する
  setSourceStream(createDummyStream({
    documentNode,
    canvasWidth: options.canvasWidth,
    canvasHeight: options.canvasHeight,
  }));

  return {
    getElement: () => pipVideoElement,
    ensureInserted,
    updateSize,
    updatePoster,
    requestPictureInPicture,
    isOwnPictureInPictureElement,
    stop,
  };
};

// エクスポート
export { createPipVideoElementAdapter };
export type { CreatePipVideoElementAdapterOptions, PipVideoElementAdapter };
