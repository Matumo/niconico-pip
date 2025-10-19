"use strict";

// サイトURLの変更を監視

// --- function ----------------------------------------------------------------
let initChangeUrlObserver = null;
// -----------------------------------------------------------------------------

const exec_observer_page_js = async function() {
  // サイトURLの変更イベント発火
  function checkUrlChange() {
    try {
      const currentUrl = window.location.href;
      // URLが変わったかどうかを確認
      if (currentUrl !== context.page.url) {
        // 動画再生ページであるかどうかを確認
        const isWatchPage = nicoVideoPageUrlPatternRegExp.test(currentUrl);
        // コンテキストを更新
        context.page.url = currentUrl;
        context.page.isWatchPage = isWatchPage;
        // イベントを発火
        console.log("{Event} Page URL changed:", currentUrl, "isWatchPage:", isWatchPage);
        window.dispatchEvent(new CustomEvent(pageUrlChangedEventName, {
          detail: {
            url: currentUrl,
            isWatchPage: isWatchPage,
          }
        }));
      } else {
        //console.debug("No URL change detected.");
      }
    } catch (error) {
      console.debug("Error checking URL change:", error);
    }
  };

  // URLの監視を開始
  initChangeUrlObserver = function () {
    console.debug("Initializing URL change observer.");
    // DOM変更を監視
    const urlChangeObserver = new MutationObserver(checkUrlChange);
    urlChangeObserver.observe(document.head, {
      childList: true,
      attributes: true,
    });
    checkUrlChange(); // 初回イベント実行
    console.debug("URL change observer initialized.");
  }
}
