// 監視機能

// --- function ----------------------------------------------------------------
let initNicoVideoObserver = null;
// -----------------------------------------------------------------------------

{
  // Video要素の監視
  let nicoVideoObserver = null;
  let currentNicoVideoElement = null;

  // 監視の開始
  initNicoVideoObserver = function (_r5Element) {
    // 監視対象
    const r5Element = _r5Element;
    if (r5Element === null) {
      console.error("[Error] R5 element is null.");
      return;
    }
    // 既に監視中の場合はスキップ
    if (r5Element === currentNicoVideoElement) {
      console.debug("R5 element is same as current nico video element. Skip.");
      return;
    }
    currentNicoVideoElement = r5Element;
    // 既存の監視を解除
    if (nicoVideoObserver) {
      console.debug("Disconnecting existing nico video observer.");
      nicoVideoObserver.disconnect();
    }
    // 新しい監視を設定
    nicoVideoObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // video要素の変更イベントを発火
          console.debug("Detected nico video element changed.");
          window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
        }
      });
    });
    // 監視の開始
    console.debug("Starting nico video observer.");
    nicoVideoObserver.observe(r5Element, {
      childList: true
    });
  }

  // サイトURLの変更イベント発火
  let lastUrl = window.location.href;
  function checkUrlChange() {
    try {
      const currentUrl = window.location.href;
      console.debug("Checking URL change.", "Current URL:", currentUrl, "Last URL:", lastUrl);
      // URLが変わったかどうかを確認
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        window.dispatchEvent(new CustomEvent(nicoVideoPageUrlChangedEventName, {}));
        console.debug("Detected URL change.");
      } else {
        console.debug("No URL change detected.");
      }
    } catch (error) {
      console.debug("Error checking URL change:", error);
    }
  };

  // URLの監視を開始
  {
    console.debug("Initializing URL change observer.");
    // 初回イベント実行
    checkUrlChange();
    // popstateイベントを監視
    window.addEventListener('popstate', function () {
      console.debug("popstate event detected.");
      checkUrlChange();
    });
    // // pushStateをオーバーライド
    // const originalPushState = window.history.pushState;
    // window.history.pushState = function (...args) {
    //   console.debug("pushState event detected with args:", args);
    //   originalPushState.apply(window.history, args);
    //   checkUrlChange();
    // };
    // // replaceStateをオーバーライド
    // const originalReplaceState = window.history.replaceState;
    // window.history.replaceState = function (...args) {
    //   console.debug("replaceState event detected with args:", args);
    //   originalReplaceState.apply(window.history, args);
    //   checkUrlChange();
    // };
    // クリックイベントを監視
    // document.addEventListener('click', function (event) {
    //   console.debug("Click event detected.", event);
    //   checkUrlChange();
    // });
    // DOM変更を監視
    const urlChangeObserver = new MutationObserver(() => {
      console.debug("DOM mutation detected for URL change.");
      checkUrlChange();
    });
    urlChangeObserver.observe(document.head, {
      childList: true,
      attributes: true,
    });
    console.debug("URL change observer initialized.");
  }
}
