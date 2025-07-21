"use strict";

// メッセージの設定

// 広告のスキップ可否の判定依頼のメッセージ名
const checkAdSkipAvailableRequestMessageName = 'CHECK_AD_SKIP_AVAILABLE_REQUEST';
// 広告のスキップ可否の判定結果のメッセージ名
const checkAdSkipAvailableResponseMessageName = 'CHECK_AD_SKIP_AVAILABLE_RESPONSE';
// 広告のスキップボタンのクリック依頼のメッセージ名
const clickAdSkipButtonRequestMessageName = 'CLICK_AD_SKIP_BUTTON_REQUEST';
// 広告のスキップボタンのクリック結果のメッセージ名
const clickAdSkipButtonResponseMessageName = 'CLICK_AD_SKIP_BUTTON_RESPONSE';

{
  // 実行環境を判定する関数
  function getExecutionContext() {
    if (typeof self !== "undefined" && self.registration) {
      return "background";
    }
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      return "content_script";
    }
    return "unknown";
  }
  const executionContext = getExecutionContext();
  // バックグラウンド実行の場合はメッセージリスナーを登録
  if (executionContext === "background") {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (message.type === checkAdSkipAvailableRequestMessageName) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: checkAdSkipAvailableRequestMessageName
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 受信者がいない場合の処理（広告が無いのにメッセージが送られたとき）
              console.warn("<Message Error> No response from content script:", chrome.runtime.lastError);
              return;
            }
            if (response && response.type === checkAdSkipAvailableResponseMessageName) {
              // スキップボタンの状態を返す
              try {
                sendResponse({
                  type: checkAdSkipAvailableResponseMessageName,
                  details: {
                    skipAvailable: response.visible,
                    sendTime: message.sendTime,
                    videoId: message.videoId,
                    url: response.url
                  }
                });
              } catch (error) {
                console.debug("<Message Error> Failed to send response:", error);
              }
            }
          });
          return true; // sendResponseでレスポンスを返す（非同期）
        }
        if (message.type === clickAdSkipButtonRequestMessageName) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: clickAdSkipButtonRequestMessageName
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 受信者がいない場合の処理（広告が無いのにメッセージが送られたとき）
              console.warn("<Message Error> No response from content script:", chrome.runtime.lastError);
              return;
            }
            if (response && response.type === clickAdSkipButtonResponseMessageName) {
              // スキップボタンがクリックされたことを通知
              try {
                sendResponse({
                  type: clickAdSkipButtonResponseMessageName,
                  details: {
                    found: response.found,
                    url: response.url
                  }
                });
              } catch (error) {
                console.debug("<Message Error> Failed to send response:", error);
              }
            }
          });
          return true; // sendResponseでレスポンスを返す（非同期）
        }
      } catch (error) {
        console.debug("<Message Error> Ad skip button check failed:", error);
      }
    });
  }
}
