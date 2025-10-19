"use strict";

// --- functions ---------------------------------------------------------------
let clickAdSkipButton = null;
// -----------------------------------------------------------------------------

// 広告スキップに関する処理
const exec_util_ad_js = async function() {
  // 広告スキップボタンのクリック
  clickAdSkipButton = () => {
    const status = context.status;
    // いきなり動画紹介の場合
    if (status.type === 'ad-nico') {
      // いきなり動画紹介のスキップボタン
      const adSkipButton = document.querySelector(selector_player_ad_skipButton);
      if (adSkipButton) {
        // スキップボタンが表示されている場合はクリック
        adSkipButton.click();
        console.debug("Ad skip button clicked for ad-nico.");
      }
    }
    // 2mdn広告の場合
    else if (status.type === 'ad-2mdn') {
      // 2mdn広告のスキップボタンを探す
      const skipButton = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.textContent?.includes('広告をスキップ') &&
        btn.querySelector('img[alt="動画広告スキップボタンの矢印画像"]')
      );
      if (skipButton && !skipButton.disabled) {
        // スキップボタンが見つかり、無効でない場合はクリック
        skipButton.click();
        console.debug("Ad skip button clicked for ad-2mdn.");
      } else {
        console.debug("Ad skip button not found or disabled for ad-2mdn.");
      }
    }
    // 通常の広告の場合
    else if (status.type === 'ad-google' || status.type === 'ad-other') {
      // スキップボタンのクリック依頼
      chrome.runtime.sendMessage({
        type: clickAdSkipButtonRequestMessageName
      }, (response) => {
        if (response && response.type === clickAdSkipButtonResponseMessageName) {
          const found = response.details.found;
          const url = response.details.url;
          console.debug(`Ad skip button clicked: ${found}, URL: ${url}`);
        }
      });
      console.debug("Ad skip button click request sent for ad-google or ad-other.");
    }
    // その他のタイプは不明
    else {
      console.debug("No ad skip button action for status type:", status.type);
    }
  }
}
