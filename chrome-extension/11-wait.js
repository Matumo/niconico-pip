// --- function ----------------------------------------------------------------
let waitForElements = null;
// -----------------------------------------------------------------------------

{
  // 準備完了まで待機する処理
  let waitForElementsInterval = null;
  waitForElements = function (callback) {
    if (waitForElementsInterval) clearInterval(waitForElementsInterval);
    const startTime = new Date().getTime();
    waitForElementsInterval = setInterval(() => {
      // タイムアウト処理
      if (new Date().getTime() - startTime > waitForElementsTimeout) {
        console.log("Timeout reached. Elements not found.");
        clearInterval(waitForElementsInterval);
        return;
      }

      // 使用する要素が追加されるまで待機
      const elements = {};
      for (const selector of waitForElementsSelectors) {
        elements[selector] = document.querySelector(selector);
        if (!elements[selector]) {
          console.log(`Waiting for ${selector}...`);
          return;
        }
      }

      // サイズに0が設定されている場合は待機
      const nicoVideoElement = document.querySelector(nicoVideoElementSelector);
      if (nicoVideoElement.videoWidth === 0 || nicoVideoElement.videoHeight === 0) {
        console.log("Waiting for video size...");
        return;
      }
      const nicoCommentsElement = document.querySelector(nicoCommentsElementSelector);
      if (nicoCommentsElement.width === 0 || nicoCommentsElement.height === 0) {
        console.log("Waiting for comments canvas size...");
        return;
      }

      // 準備完了
      console.log("Elements are ready.");
      clearInterval(waitForElementsInterval);
      callback(elements);
    }, waitForElementsIntervalTime);
  }
}
