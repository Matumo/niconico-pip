"use strict";

// タイマーの監視機能
{
  const observerName = "timer";

  // タイマーを永続的に監視する関数
  function observeTimeForever() {
    const timerElement = context.elements.controller.timerCurrentTime;
    if (!timerElement) {
      console.warn("Timer element not found.");
      return;
    }

    // コールバック関数
    const callback = function () {
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      // 要素の取得
      const durationElement = context.elements.controller.timerDuration;
      const currentTimeElement = context.elements.controller.timerCurrentTime;
      if (!durationElement || !currentTimeElement) {
        clearTimeContext();
        console.debug("Element not found:", observerName);
        return true; // 監視を継続する
      }
      // 現在時間と合計時間のテキストを取得
      const duration = durationElement.textContent;
      const currentTime = currentTimeElement.textContent;
      if (!duration || !currentTime) {
        clearTimeContext();
        console.debug("Time elements are empty:", observerName);
        return true; // 監視を継続する
      }
      // コンテキストを更新
      updateTimeContext(currentTime, duration);
      return true; // 監視を継続する
    };

    // 監視の開始
    startObserver(observerName, timerElement, callback, {
      characterData: true,
      subtree: true
    });
    console.debug(`Started observing for ${observerName}.`);
  }

  // タイマーの監視を開始するイベントリスナー
  addEventListener(window, "タイマー要素の変更時にタイマーの永続的な監視を開始",
                   elementChangedEventName, (event) => {
    const { detail } = event;
    const category = detail.category;
    const name = detail.name;
    const element = detail.element;
    if (category === "controller" && name === "timerCurrentTime" && element) {
      // タイマーの現在時間が取得可能になったら監視を開始
      observeTimeForever();
    }
  });
}
