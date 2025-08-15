"use strict";

// 動画のサムネイルを取得する機能

// --- function ----------------------------------------------------------------
let getNicoVideoThumbnailImage = null;
// -----------------------------------------------------------------------------

// meta[property="og:image"] から取得する
// "https://img.cdn.nimg.jp/s/nicovideo/thumbnails/" で始まるものに限定する

{
  // キャッシュキー生成
  const CACHE_KEY_NICO_VIDEO_THUMBNAIL_BASE = "nico_video_thumbnail_image";
  function buildThumbnailCacheKey(pageUrl) {
    if (!pageUrl || typeof pageUrl !== 'string') pageUrl = 'unknown';
    return CACHE_KEY_NICO_VIDEO_THUMBNAIL_BASE + '|' + pageUrl;
  }

  // キャッシュキーリスト
  let cache_keys = [];
  // キャッシュの最大保有数
  const CACHE_MAX_SIZE = 5;
  // キャッシュの個数チェック関数
  function checkCacheSize() {
    // キャッシュの最大保有数を超えた場合は、キャッシュキーリストの全キャッシュをクリアする
    if (cache_keys.length > CACHE_MAX_SIZE) {
      for (const key of cache_keys) {
        cache_delete(key);
        console.debug("Clearing cache for key:", key);
      }
      cache_keys = [];
    }
  }

  // サムネイル画像の取得
  getNicoVideoThumbnailImage = function (pageUrl, { timeoutMs = 8000 } = {}) {
    // URLチェック
    const WatchPage_Prefix = "https://www.nicovideo.jp/watch/";
    if (!pageUrl.startsWith(WatchPage_Prefix)) {
      console.warn("Invalid URL:", pageUrl);
      return null;
    }

    // キャッシュキーを生成
    const CACHE_KEY_NICO_VIDEO_THUMBNAIL = buildThumbnailCacheKey(pageUrl);
    // ロード済みの場合はキャッシュの値を返す
    const status = cache_getStatus(CACHE_KEY_NICO_VIDEO_THUMBNAIL);
    if (status === "loaded") {
      return cache_getData(CACHE_KEY_NICO_VIDEO_THUMBNAIL);
    }
    // ロード中はnullを返す
    if (status === "loading") {
      return null;
    }
    // エラー時はリトライ可能ならロードに進む
    // リトライ不可能ならnullを返す
    if (status === "error") {
      if (cache_canRetry(CACHE_KEY_NICO_VIDEO_THUMBNAIL)) {
        console.debug("Thumbnail loading failed. Retrying...");
      } else {
        console.debug("Thumbnail loading failed. Waiting for retry.");
        return null;
      }
    }

    // キャッシュサイズのチェック
    checkCacheSize();

    // ロード開始
    cache_set(CACHE_KEY_NICO_VIDEO_THUMBNAIL, "loading", null);
    // キャッシュキーリストに追加
    cache_keys.push(CACHE_KEY_NICO_VIDEO_THUMBNAIL);

    (async () => {
      try {
        // URL取得
        // エラー時はキャッシュにエラー状態を保存
        const url = await getNicoVideoThumbnailUrl(pageUrl, { timeoutMs });
        if (!url) {
          console.debug("Thumbnail URL not found.");
          cache_set(CACHE_KEY_NICO_VIDEO_THUMBNAIL, "error", null);
          return;
        }
        // ロード処理（非同期）
        const img = new Image();
        img.crossOrigin = 'anonymous'; // CORS回避
        img.src = url;
        // ロード完了時にキャッシュに保存
        img.onload = () => {
          console.debug("Thumbnail image loaded.");
          cache_set(CACHE_KEY_NICO_VIDEO_THUMBNAIL, "loaded", img);
          console.debug("Thumbnail URL:", img.src);
          console.debug("Thumbnail natural size:", img.naturalWidth, "x", img.naturalHeight);
        };
        // エラー時はキャッシュにエラー状態を保存
        img.onerror = (e) => {
          console.debug("Failed to load thumbnail image.", e);
          cache_set(CACHE_KEY_NICO_VIDEO_THUMBNAIL, "error", null);
        };
      } catch (e) {
        // 例外発生時はキャッシュにエラー状態を保存
        console.debug("Exception while loading thumbnail image.", e);
        cache_set(CACHE_KEY_NICO_VIDEO_THUMBNAIL, "error", null);
      }
    })();

    // ロード開始したので現時点では null
    return null;
  };

  // 非同期でサムネイル画像のURLを返す
  async function getNicoVideoThumbnailUrl(pageUrl, { timeoutMs = 8000 } = {}) {
    const html = await fetchHtmlWithTimeout(pageUrl, timeoutMs);
    if (!html) return null;
    console.debug("Fetched HTML for thumbnail:", pageUrl);
    // console.debug("Fetched HTML content:", html); // 必要なら有効化
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const images = collectOgImageUrls(doc, pageUrl, true);
    console.log(images);
    return images.length > 0 ? images[0] : null;
  };

  // プレフィックス（これで始まるURLのみを有効とみなす）
  const VALID_PREFIX = 'https://img.cdn.nimg.jp/s/nicovideo/thumbnails/';

  // og:image を収集する
  // 1件だけ取得する場合は once を true にする
  function collectOgImageUrls(doc, baseUrl, once = false) {
    const metas = doc.querySelectorAll('meta[property="og:image"]');
    const seen = new Set();
    const out = [];
    for (const m of metas) {
      console.debug("Found og:image meta tag:", m);
      const raw = (m.getAttribute('content') || '').trim();
      if (!raw) continue;
      const url = toAbsoluteUrl(raw, baseUrl);
      if (!url) continue;
      if (url.startsWith(VALID_PREFIX) && !seen.has(url)) {
        seen.add(url);
        out.push(url);
        if (once) break; // 1件だけ取得する場合はここで終了
      }
    }
    return out;
  }

  // タイムアウト付きでHTMLを取得する
  async function fetchHtmlWithTimeout(url, timeoutMs) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',            // 3xxリダイレクトは自動追従
        referrerPolicy: 'no-referrer', // Refererを送らない（プライバシー配慮）
        signal: ac.signal,             // AbortController で中断可能
        credentials: 'omit',           // Cookie等は送らない（意図せぬ認証送信を防止）
      });
      const content_type = res.headers.get('content-type') || '';
      if (!content_type.includes('text/html')) return null; // HTML以外は対象外
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // 相対URLを絶対URLに変換する
  function toAbsoluteUrl(u, base) {
    try {
      return new URL(u, base).href;
    } catch {
      return null;
    }
  }
}
