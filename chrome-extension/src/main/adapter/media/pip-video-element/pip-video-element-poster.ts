/**
 * PiP動画要素 poster変換
 */

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  Image?: typeof Image;
};

// poster変換で利用する最小Document型
type DocumentLike = Pick<Document, "createElement">;

// サムネイルURLを16:9へ変換する関数
const makePoster16By9 = async (
  thumbnailUrl: string,
  documentNode: DocumentLike,
): Promise<string> => {
  const browserGlobal = globalThis as BrowserGlobal;
  const ImageCtor = browserGlobal.Image;
  if (typeof ImageCtor !== "function") {
    throw new TypeError("poster conversion is unavailable");
  }

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
    // 失敗時は元URLを渡す
    image.onerror = () => {
      reject(new Error("poster image load failed"));
    };
    image.src = thumbnailUrl;
  });
};

// エクスポート
export { makePoster16By9 };
export type { DocumentLike as PipVideoPosterDocumentLike };
