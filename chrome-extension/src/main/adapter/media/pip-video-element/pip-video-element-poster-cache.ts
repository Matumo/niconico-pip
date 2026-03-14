/**
 * PiP動画要素 poster変換キャッシュ
 */
interface CreatePosterDataUrlCacheOptions {
  maxEntries?: number;
}

interface PosterDataUrlCache {
  get(thumbnailUrl: string): Promise<string> | undefined;
  set(thumbnailUrl: string, posterDataUrl: Promise<string>): void;
  delete(thumbnailUrl: string): void;
}

const defaultPosterDataUrlCacheMaxEntries = 3;

// access keyを除いたcache keyへ正規化する関数
const normalizePosterCacheKey = (thumbnailUrl: string): string => {
  try {
    const normalizedUrl = new URL(thumbnailUrl);
    normalizedUrl.searchParams.delete("key");
    return normalizedUrl.toString();
  } catch {
    return thumbnailUrl;
  }
};

const createPosterDataUrlCache = (
  options: CreatePosterDataUrlCacheOptions,
): PosterDataUrlCache => {
  const maxEntries = options.maxEntries ?? defaultPosterDataUrlCacheMaxEntries;
  const cache = new Map<string, Promise<string>>();

  // 正規化済みkeyで既存entryを参照する関数
  const get = (thumbnailUrl: string): Promise<string> | undefined => {
    const cacheKey = normalizePosterCacheKey(thumbnailUrl);
    return cache.get(cacheKey);
  };

  // 新規entryを追加し、上限超過時は最古entryから破棄する関数
  const set = (thumbnailUrl: string, posterDataUrl: Promise<string>): void => {
    const cacheKey = normalizePosterCacheKey(thumbnailUrl);
    cache.set(cacheKey, posterDataUrl);
    while (cache.size > maxEntries) {
      const oldestCacheKey = cache.keys().next().value;
      if (oldestCacheKey === undefined) break;
      cache.delete(oldestCacheKey);
    }
  };

  // 正規化済みkeyに対応するentryを削除する関数
  const deleteCache = (thumbnailUrl: string): void => {
    const cacheKey = normalizePosterCacheKey(thumbnailUrl);
    cache.delete(cacheKey);
  };

  return {
    get,
    set,
    delete: deleteCache,
  };
};

export { createPosterDataUrlCache };
export type { CreatePosterDataUrlCacheOptions, PosterDataUrlCache };
