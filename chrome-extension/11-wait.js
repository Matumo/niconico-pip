// --- function ----------------------------------------------------------------
let waitForElements = null;
// -----------------------------------------------------------------------------

{
  // 要素を取得する関数
  function getElements() {
    // 使用する要素が追加されるまで待機
    const elements = {};
    for (const selector of waitForElementsSelectors) {
      elements[selector] = document.querySelector(selector);
      if (!elements[selector]) {
        console.debug(`Waiting for ${selector}...`);
        return;
      }
    }
    // サイズに0が設定されている場合は待機
    const nicoVideoElement = document.querySelector(nicoVideoElementSelector);
    if (nicoVideoElement.videoWidth === 0 || nicoVideoElement.videoHeight === 0) {
      console.debug("Waiting for video size...");
      return;
    }
    const nicoCommentsElement = document.querySelector(nicoCommentsElementSelector);
    if (nicoCommentsElement.width === 0 || nicoCommentsElement.height === 0) {
      console.debug("Waiting for comments canvas size...");
      return;
    }
    return elements;
  }

  // 準備完了まで待機する処理
  let waitForElementsInterval = null;
  waitForElements = function (callback) {
    // 既に待機中のインターバルがあればクリア
    if (waitForElementsInterval) clearInterval(waitForElementsInterval);
    // インターバルの設定
    const startTime = new Date().getTime();
    let waitForElementsIntervalTime = waitForElementsIntervalTimeMin;
    let waitForElementsLoopCount = 0;
    function intervalFunc() {
      // 要素を取得
      const elements = getElements();
      if (elements) {
        const diff = new Date().getTime() - startTime;
        console.debug("Elements are ready.", `Time taken: ${diff} ms`);
        clearInterval(waitForElementsInterval);
        callback(elements);
        return;
      }
      // ループ回数をカウント
      waitForElementsLoopCount++;
      if (waitForElementsLoopCount >= waitForElementsIntervalTimeLoopCount) {
        waitForElementsLoopCount = 0;
        // タイムアウト処理
        const diff = new Date().getTime() - startTime;
        if (diff > waitForElementsTimeout) {
          console.warn("Timeout reached. Elements not found.");
          clearInterval(waitForElementsInterval);
          return;
        }
        // 待機時間が既に最大値に達している場合は何もしない
        if (waitForElementsIntervalTime === waitForElementsIntervalTimeMax) {
          console.debug("Wait interval already at maximum. No adjustment needed.",
            `Max interval: ${waitForElementsIntervalTimeMax} ms`);
          return;
        }
        // 待機時間を見直す
        waitForElementsIntervalTime = Math.min(
          waitForElementsIntervalTime + waitForElementsIntervalTimeMin,
          waitForElementsIntervalTimeMax
        );
        console.debug(`Adjusting wait interval to ${waitForElementsIntervalTime} ms.`);
        // 既存のインターバルをクリアして再設定
        clearInterval(waitForElementsInterval);
        waitForElementsInterval = setInterval(intervalFunc, waitForElementsIntervalTime);
      }
    }
    // 処理開始
    console.debug(`Starting wait for elements with interval ${waitForElementsIntervalTime} ms.`);
    waitForElementsInterval = setInterval(intervalFunc, waitForElementsIntervalTime);
  }
}
