"use strict";

// 動画のサムネイルを取得する機能

// --- function ----------------------------------------------------------------
let getNicoVideoThumbnailImage = null;
// -----------------------------------------------------------------------------

// meta[property="og:image"] から取得する
// "https://img.cdn.nimg.jp/s/nicovideo/thumbnails/" で始まるものに限定する

{
  // 非同期でサムネイル画像を取得
  let nicoVideoThumbnailImage = null;
  getNicoVideoThumbnailImage = async (pageUrl, { timeoutMs = 8000 } = {}) => {
    const url = await getNicoVideoThumbnailUrl(pageUrl, { timeoutMs });
    if (!url) return null;
    if (nicoVideoThumbnailImage) {
      return nicoVideoThumbnailImage;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS回避
    img.src = url;
    nicoVideoThumbnailImage = img;
    return img;
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
