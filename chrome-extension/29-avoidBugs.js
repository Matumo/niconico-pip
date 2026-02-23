// https://github.com/Matumo/niconico-pip/issues/69
(function() {
  // メッセージタイプ
  const pipStateRequestMessageType = "com-matumo-dev-niconico-pip:msg:get-pip-state";

  // メッセージ対応確認
  const hasRuntimeMessageApi = (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage
  );
  if (!hasRuntimeMessageApi) return;

  // SPAトリガー
  const runSpaTrigger = (reason) => {
    const pipActive = document.pictureInPictureElement === videoPipElement;
    if (!pipActive) {
      console.debug("バグ回避#69: SPAトリガー スキップ", {reason});
      return;
    }
    const currentUrl = globalThis.location.href;
    history.replaceState({}, '', currentUrl);
    console.debug("バグ回避#69: SPAトリガー 実行", {reason});
  }

  // メッセージ受信 & 応答
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== pipStateRequestMessageType) return;
    const pipActive = document.pictureInPictureElement === videoPipElement;
    console.debug("バグ回避#69: 問い合わせ受信", { pipActive });
    runSpaTrigger("問い合わせ受信");
    sendResponse({ pipActive });
  });

  // 可視性変更イベントリスナー
  globalThis.addEventListener("visibilitychange", () => {
    console.debug("バグ回避#69: 可視性変更");
    runSpaTrigger("可視性変更");
  });

  // アクティブイベントリスナー
  // globalThis.addEventListener("focus", () => {
  //   console.debug("バグ回避#69: アクティブ");
  // });

  // 非アクティブイベントリスナー
  globalThis.addEventListener("blur", () => {
    console.debug("バグ回避#69: 非アクティブ");
    runSpaTrigger("非アクティブ");
  });
})();
