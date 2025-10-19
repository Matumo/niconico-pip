"use strict";

// 広告のスキップに関する処理
const exec_ad_ad_js = async function() {
  console.log("Loading ad skip script.", "URL:", window.location.href);

  // iframe内も含めてセレクタで要素を検索する関数
  function querySelectorInFrames(selector) {
    // まずメインドキュメントで検索
    let element = document.querySelector(selector);
    if (element) {
      return element;
    }
    // iframe内も検索
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
          element = iframeDoc.querySelector(selector);
          if (element) {
            return element;
          }
        }
      } catch (error) {
        // クロスオリジンiframeの場合はアクセスできないためスキップ
        console.debug("Cannot access iframe content (cross-origin):", error);
      }
    }
    return null;
  }

  // スキップボタンの判定関数
  function isSkipButtonVisible() {
    // pattern 1
    const pattern1_SkipContainer = querySelectorInFrames('.videoAdUiSkipContainer');
    if (pattern1_SkipContainer) {
      const style = pattern1_SkipContainer.style;
      return style.opacity === '1';
    }
    // pattern 2
    const pattern2_SkipButton = querySelectorInFrames('[aria-label="Skip Ad"]');
    if (pattern2_SkipButton) {
      const style = pattern2_SkipButton.style;
      return style.opacity === '1';
    }
    // pattern 3
    const pattern3_SkipButton = querySelectorInFrames('#request_skip');
    if (pattern3_SkipButton) {
      const style = pattern3_SkipButton.style;
      return style.visibility === 'visible';
    }
    return null;
  }

  // background.js からのメッセージ受信対応
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.type === checkAdSkipAvailableRequestMessageName) {
        const skipAvailable = isSkipButtonVisible();
        sendResponse({
          type: checkAdSkipAvailableResponseMessageName,
          visible: skipAvailable,
          url: window.location.href
        });
        return true; // 非同期応答
      }
      if (message.type === clickAdSkipButtonRequestMessageName) {
        const pattern1_SkipContainer = document.querySelector('.videoAdUiSkipContainer > button');
        const pattern2_SkipButton = document.querySelector('button[aria-label="Skip Ad"]');
        const pattern3_SkipButton = document.querySelector('#request_skip');
        let skipButtonClicked = false;
        if (pattern1_SkipContainer) {
          pattern1_SkipContainer.click();
          skipButtonClicked = true;
        }
        if (pattern2_SkipButton) {
          pattern2_SkipButton.click();
          skipButtonClicked = true;
        }
        if (pattern3_SkipButton) {
          pattern3_SkipButton.click();
          skipButtonClicked = true;
        }
        console.debug("Skip button clicked:", skipButtonClicked);
        sendResponse({
          type: clickAdSkipButtonResponseMessageName,
          found: skipButtonClicked,
          url: window.location.href
        });
        return true; // 非同期応答
      }
    } catch (error) {
      console.debug("<Message Error> Ad skip button check failed:", error);
    }
  });
}
