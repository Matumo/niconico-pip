/**
 * PiP動画要素アダプター
 */
import { waitForLoadedMetadata } from "@main/adapter/media/pip-video-element/pip-video-element-loaded-metadata";
import { makePoster16By9 } from "@main/adapter/media/pip-video-element/pip-video-element-poster";
import { calculatePipVideoElementSize } from "@main/adapter/media/pip-video-element/pip-video-element-size";

// PiP動画要素アダプター生成の入力型
interface CreatePipVideoElementAdapterOptions {
  elementId: string;
  canvasWidth: number;
  canvasHeight: number;
}

// PiP動画要素アダプター型
interface PipVideoElementAdapter {
  getElement(): HTMLVideoElement;
  updatePipVideoPlacement(target: HTMLDivElement | null): boolean;
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

  let sizeObserver: ResizeObserver | null = null;

  // PiP動画要素をDOMから外して監視も止める関数
  const detach = (): void => {
    if (sizeObserver) {
      sizeObserver.disconnect();
      sizeObserver = null;
    }

    if (pipVideoElement.parentElement) {
      pipVideoElement.remove();
    }
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

  // PiP動画要素の挿入先を更新する関数
  const updatePipVideoPlacement = (target: HTMLDivElement | null): boolean => {
    // 配置先がなければPiP動画要素をDOMから削除してサイズ監視を停止
    if (!target) {
      detach();
      return true;
    }
    // DOMに未接続の要素には配置しない
    if (!target.parentElement) return false;

    // 異なるPiP動画要素で同じidの残存要素はDOMから削除
    const existingElement = documentNode.getElementById(pipVideoElement.id);
    if (existingElement && existingElement !== pipVideoElement) {
      existingElement.remove();
    }
    // 同じ配置先の先頭にいるなら再配置は不要
    if (pipVideoElement.parentElement === target && target.firstChild === pipVideoElement) {
      return true;
    }

    // 配置先を更新したらPiP動画要素を挿入してサイズ監視を開始
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
    // 再初期化時に重複要素が残らないよう、DOMから要素を外す
    detach();
  };

  return {
    getElement: () => pipVideoElement,
    updatePipVideoPlacement,
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
