/**
 * PiP動画要素 poster変換
 */
import { appLoggerNames } from "@main/platform/logger";
import { type PosterDataUrlCache } from "@main/adapter/media/pip-video-element/pip-video-element-poster-cache";
import { getLogger } from "@matumo/ts-simple-logger";

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  Image?: typeof Image;
  document?: unknown;
};

// poster変換で利用する最小Document型
interface PosterDocumentLike {
  createElement(tagName: string): Element;
}

interface GetPosterDataUrlOptions {
  thumbnailUrl: string;
  posterDataUrlCache: PosterDataUrlCache;
}

const log = getLogger(appLoggerNames.media);

// poster変換に必要なdocumentかどうかを判定する関数
const isPosterDocumentLike = (value: unknown): value is PosterDocumentLike =>
  typeof (value as Partial<PosterDocumentLike> | null)?.createElement === "function";

// poster変換に必要なdocumentを取得する関数
const resolvePosterDocument = (): PosterDocumentLike => {
  const browserGlobal = globalThis as BrowserGlobal;
  const documentNode = browserGlobal.document;
  if (!isPosterDocumentLike(documentNode)) {
    throw new TypeError("poster conversion document is unavailable");
  }
  return documentNode;
};

// サムネイルURLを16:9へ変換する関数
const makePoster16By9 = async (
  thumbnailUrl: string,
): Promise<string> => {
  const browserGlobal = globalThis as BrowserGlobal;
  const ImageCtor = browserGlobal.Image;
  if (typeof ImageCtor !== "function") {
    throw new TypeError("poster conversion is unavailable");
  }
  const documentNode = resolvePosterDocument();

  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    // サムネイル配信元が別オリジンでもcanvas変換できるように匿名CORSを指定する
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const sourceWidth = image.width;
        const sourceHeight = image.height;
        // 幅を維持したまま16:9になる高さを算出し、上下を中央基準でトリミングする
        const targetHeight = sourceWidth * 9 / 16;
        const canvasElement = documentNode.createElement("canvas");
        if (!(canvasElement instanceof HTMLCanvasElement)) {
          reject(new TypeError("poster conversion canvas is unavailable"));
          return;
        }

        canvasElement.width = sourceWidth;
        canvasElement.height = targetHeight;
        const context = canvasElement.getContext("2d");
        if (!context) {
          reject(new TypeError("poster conversion context is unavailable"));
          return;
        }

        // 元画像の中央領域を切り出して、変換後canvasに等倍で描画する
        const offsetY = (sourceHeight - targetHeight) / 2;
        context.drawImage(image, 0, offsetY, sourceWidth, targetHeight, 0, 0, sourceWidth, targetHeight);

        // 変換後のデータURLを渡す
        resolve(canvasElement.toDataURL());
      } catch (error: unknown) {
        reject(error);
      }
    };
    // 失敗時はrejectする
    image.onerror = () => {
      reject(new Error("poster image load failed"));
    };
    image.src = thumbnailUrl;
  });
};

// サムネイルURLからposter用data URLを取得する関数
const getPosterDataUrl = (
  options: GetPosterDataUrlOptions,
): Promise<string> => {
  const cachedPosterDataUrl = options.posterDataUrlCache.get(options.thumbnailUrl);
  log.debug(`poster cache ${cachedPosterDataUrl ? "hit" : "miss"}`);
  if (cachedPosterDataUrl) {
    return cachedPosterDataUrl;
  }

  const posterDataUrlPromise = makePoster16By9(options.thumbnailUrl)
    .catch((error: unknown) => {
      options.posterDataUrlCache.delete(options.thumbnailUrl);
      throw error;
    });

  options.posterDataUrlCache.set(options.thumbnailUrl, posterDataUrlPromise);
  return posterDataUrlPromise;
};

// エクスポート
export { getPosterDataUrl };
export type { GetPosterDataUrlOptions };
