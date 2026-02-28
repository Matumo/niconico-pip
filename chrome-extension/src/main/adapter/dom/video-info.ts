/**
 * 動画情報取得アダプター
 */

// 動画情報の最小スナップショット型
interface VideoInfoSnapshot {
  title: string | null;
  author: string | null;
  thumbnail: string | null;
}

// 動画情報取得アダプター型
interface VideoInfoAdapter {
  resolve(): VideoInfoSnapshot;
}

// JSONオブジェクトの最小表現型
type JsonRecord = Record<string, unknown>;

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  document?: Document;
};

// querySelectorAll を使うための最小Document型
type DocumentLike = {
  querySelectorAll?: (selectors: string) => NodeListOf<Element>;
};

// 空の動画情報を返す関数
const createEmptyVideoInfoSnapshot = (): VideoInfoSnapshot => ({
  title: null,
  author: null,
  thumbnail: null,
});

// オブジェクト判定ヘルパー関数
const isObjectRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

// @type が VideoObject か判定する関数
const isVideoObject = (value: unknown): value is JsonRecord =>
  isObjectRecord(value) && value["@type"] === "VideoObject";

// JSON-LD値から VideoObject を探す関数
const resolveVideoObjectFromJsonLdValue = (value: unknown): JsonRecord | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isVideoObject(item)) return item;
    }
    return null;
  }
  return isVideoObject(value) ? value : null;
};

// 配列から先頭の有効文字列URLを取り出す関数
const resolveFirstValidStringUrl = (values: unknown[]): string | null => {
  for (const entry of values) {
    if (typeof entry === "string" && entry.trim() !== "") return entry;
  }
  return null;
};

// 配列から先頭の有効サムネイルURLを取り出す関数
const resolveFirstValidThumbnailUrl = (values: unknown[]): string | null => {
  for (const entry of values) {
    const resolvedUrl = resolveThumbnailUrlFromEntry(entry);
    if (resolvedUrl) return resolvedUrl;
  }
  return null;
};

// thumbnail項目1件からURLを取り出す関数
const resolveThumbnailUrlFromEntry = (entry: unknown): string | null => {
  if (typeof entry === "string" && entry.trim() !== "") return entry;
  if (!isObjectRecord(entry)) return null;
  const url = entry.url;
  if (typeof url !== "string" || url.trim() === "") return null;
  return url;
};

// VideoObject からサムネイルURLを取り出す関数
const resolveThumbnailUrl = (videoObject: JsonRecord): string | null => {
  // NOTE: 想定するJSON-LDは VideoObject.thumbnail(ImageObject配列) /
  // thumbnailUrl(文字列配列) を持つため、その順で有効URLを解決する。
  const thumbnail = videoObject.thumbnail;
  if (Array.isArray(thumbnail) && thumbnail.length > 0) {
    const resolvedUrl = resolveFirstValidThumbnailUrl(thumbnail);
    if (resolvedUrl) return resolvedUrl;
  } else if (thumbnail !== undefined) {
    const resolvedUrl = resolveThumbnailUrlFromEntry(thumbnail);
    if (resolvedUrl) return resolvedUrl;
  }

  const thumbnailUrl = videoObject.thumbnailUrl;
  if (Array.isArray(thumbnailUrl) && thumbnailUrl.length > 0) {
    return resolveFirstValidStringUrl(thumbnailUrl);
  }
  if (typeof thumbnailUrl === "string" && thumbnailUrl.trim() !== "") return thumbnailUrl;
  return null;
};

// VideoObject から投稿者名を取り出す関数
const resolveAuthor = (videoObject: JsonRecord): string | null => {
  const author = videoObject.author;
  if (typeof author === "string" && author.trim() !== "") return author;
  if (!isObjectRecord(author)) return null;

  const authorName = author.name;
  if (typeof authorName !== "string" || authorName.trim() === "") return null;
  return authorName;
};

// VideoObject からタイトルを取り出す関数
const resolveTitle = (videoObject: JsonRecord): string | null => {
  const name = videoObject.name;
  if (typeof name !== "string" || name.trim() === "") return null;
  return name;
};

// VideoObject から動画情報スナップショットを作る関数
const createVideoInfoSnapshot = (videoObject: JsonRecord): VideoInfoSnapshot => {
  const title = resolveTitle(videoObject);
  const author = resolveAuthor(videoObject);
  const thumbnail = resolveThumbnailUrl(videoObject);
  return { title, author, thumbnail };
};

// script[type="application/ld+json"] から VideoObject を探す関数
const resolveVideoObject = (documentNode: DocumentLike): JsonRecord | null => {
  if (typeof documentNode.querySelectorAll !== "function") return null;

  const scripts = documentNode.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    if (!(script instanceof HTMLScriptElement)) continue;
    const scriptText = script.textContent;
    if (!scriptText) continue;

    try {
      const parsedValue: unknown = JSON.parse(scriptText);
      const videoObject = resolveVideoObjectFromJsonLdValue(parsedValue);
      if (videoObject) return videoObject;
    } catch {
      // パース失敗時は次のscriptを試す
      continue;
    }
  }

  return null;
};

// 動画情報取得アダプターを作成する関数
const createVideoInfoAdapter = (): VideoInfoAdapter => {
  // 現在のDOMから動画情報を再解決する関数
  const resolve = (): VideoInfoSnapshot => {
    const browserGlobal = globalThis as BrowserGlobal;
    const documentNode = browserGlobal.document;
    if (!documentNode) return createEmptyVideoInfoSnapshot();

    const videoObject = resolveVideoObject(documentNode);
    if (!videoObject) return createEmptyVideoInfoSnapshot();
    return createVideoInfoSnapshot(videoObject);
  };

  return {
    resolve,
  };
};

// エクスポート
export { createVideoInfoAdapter };
export type { VideoInfoSnapshot, VideoInfoAdapter };
