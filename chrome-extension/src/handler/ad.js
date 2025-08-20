"use strict";

// 広告スキップに関する処理
{
  // ステータスの変化を検出
  addEventListener(window, "ステータス更新時に広告スキップボタンを描画またはクリック",
                   statusChangedEventName, (event) => {
    const { detail } = event;
    const status = detail.status;
    if (status.type?.startsWith('ad-') && status.details === 'skipAvailable') {
      // 広告スキップ可能な状態になった場合
      console.debug(`Ad skip available: ${status.index}`);
      // スキップボタンをクリック
      if (debugMode && debug_adAutoSkip) {
        console.debug("Debug mode: Auto skipping ad.");
        clickAdSkipButton();
      }
      // PIPにスキップボタンを表示
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler('skipad', () => {
          console.debug("Ad skip button clicked.");
          // スキップボタンをクリック
          clickAdSkipButton();
        });
      }
    } else {
      console.debug("Ad skip button not available or not in ad status.");
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler('skipad', null);
      }
    }
  });
}
