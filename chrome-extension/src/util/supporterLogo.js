"use strict";

// ニコニ貢献のロゴを取得する機能

// --- function ----------------------------------------------------------------
let getNicoSupporterLogo = null;
// -----------------------------------------------------------------------------

const exec_util_supporterLogo_js = async function() {
  // キャッシュキー
  const CACHE_KEY_SUPPORTER_LOGO = "supporter_logo_image";

  // ニコニ貢献のロゴ取得
  getNicoSupporterLogo = function () {
    // ロード済みの場合はキャッシュの値を返す
    const status = cache_getStatus(CACHE_KEY_SUPPORTER_LOGO);
    if (status === "loaded") {
      return cache_getData(CACHE_KEY_SUPPORTER_LOGO);
    }
    // ロード中はnullを返す
    if (status === "loading") {
      console.debug("Nico supporter logo is still loading.");
      return null;
    }
    // エラー時はリトライ可能ならロードに進む
    // リトライ不可能ならnullを返す
    if (status === "error") {
      if (cache_canRetry(CACHE_KEY_SUPPORTER_LOGO)) {
        console.debug("Nico supporter logo loading failed. Retrying...");
      } else {
        console.debug("Nico supporter logo loading failed. Waiting for retry.");
        return null;
      }
    }

    // ロード開始
    cache_set(CACHE_KEY_SUPPORTER_LOGO, "loading", null);

    // URL取得
    // エラー時はキャッシュにエラー状態を保存
    const logoElement = document.querySelector(selector_player_menu_contents_supporter_logo);
    if (!logoElement) {
      console.debug("Nico supporter logo element not found.");
      cache_set(CACHE_KEY_SUPPORTER_LOGO, "error", null);
      return null;
    }
    const logoUrl = logoElement.src;
    if (!logoUrl) {
      console.debug("Nico supporter logo URL is empty.");
      cache_set(CACHE_KEY_SUPPORTER_LOGO, "error", null);
      return null;
    }

    // ロード処理（非同期）
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logoUrl;
    // ロード完了時に後処理をしてキャッシュに保存
    img.onload = () => {
      console.debug("Nico supporter logo cached successfully.");
      const h = 45;
      const scaleFactor = h / img.naturalHeight;
      img.width = img.width * scaleFactor;
      img.height = h;
      cache_set(CACHE_KEY_SUPPORTER_LOGO, "loaded", img);
      console.debug("Nico supporter logo URL:", img.src);
      console.debug("Nico supporter logo natural size:", img.naturalWidth, "x", img.naturalHeight);
      console.debug("Nico supporter logo current size:", img.width, "x", img.height);
    };
    // エラー時はキャッシュにエラー状態を保存
    img.onerror = (e) => {
      console.debug("Failed to cache Nico supporter logo.", e);
      cache_set(CACHE_KEY_SUPPORTER_LOGO, "error", null);
      return null;
    };

    // ロード中はnullを返す
    return null;
  };
}
