"use strict";

// ニコニ貢献のロゴを取得する機能

// --- function ----------------------------------------------------------------
let getNicoSupporterLogo = null;
// -----------------------------------------------------------------------------

{
  let nicoSupporterLogoImg = null;
  let nicoSupporterLogoImgStatus = "none"; // none, loading, loaded, error
  let nicoSupporterLogoImgLastUpdated = 0; // 最後に更新した時間（ミリ秒）

  // ニコニ貢献のロゴ取得
  getNicoSupporterLogo = function () {
    if (nicoSupporterLogoImgStatus === "loaded") {
      return nicoSupporterLogoImg;
    }
    if (nicoSupporterLogoImgStatus === "loading") {
      console.debug("Nico supporter logo is still loading.");
      return nicoSupporterLogoImg;
    }
    if (nicoSupporterLogoImgStatus === "error") {
      // 5秒経過している場合は再読み込み
      const now = performance.now();
      if (now - nicoSupporterLogoImgLastUpdated > 5 * 1000) {
        console.debug("Nico supporter logo loading failed. Retrying...");
      } else {
        console.debug("Nico supporter logo loading failed. Waiting for retry.");
        return null;
      }
    }
    // ロード前の初期化
    nicoSupporterLogoImgStatus = "loading";
    nicoSupporterLogoImg = null;
    nicoSupporterLogoImgLastUpdated = performance.now();
    // ロゴ要素を取得
    const nicoSupporterLogoElement = document.querySelector(selector_player_menu_contents_supporter_logo);
    if (!nicoSupporterLogoElement) {
      console.debug("Nico supporter logo element not found.");
      nicoSupporterLogoImgStatus = "error";
      return null;
    }
    // img要素の画像をfetchしてキャッシュ
    const logoUrl = nicoSupporterLogoElement.src;
    if (!logoUrl) {
      console.debug("Nico supporter logo URL is empty.");
      nicoSupporterLogoImgStatus = "error";
      return null;
    }
    // ロゴデータ
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS回避
    img.src = logoUrl;
    img.onload = () => {
      console.debug("Nico supporter logo cached successfully.");
      // 高さを変更
      const h = 45;
      const scaleFactor = h / img.naturalHeight;
      img.width = img.width * scaleFactor;
      img.height = h;
      // キャッシュに保存
      nicoSupporterLogoImg = img;
      nicoSupporterLogoImgStatus = "loaded";
      nicoSupporterLogoImgLastUpdated = performance.now();
      // デバッグ用にコンソールに出力
      console.debug("Nico supporter logo URL:", img.src);
      console.debug("Nico supporter logo natural size:", img.naturalWidth, "x", img.naturalHeight);
      console.debug("Nico supporter logo current size:", img.width, "x", img.height);
    };
    img.onerror = (e) => {
      console.debug("Failed to cache Nico supporter logo.", e);
      nicoSupporterLogoImgStatus = "error";
      nicoSupporterLogoImgLastUpdated = performance.now();
      return null;
    };
    return nicoSupporterLogoImg;
  }
}
