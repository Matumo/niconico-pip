// --- function ----------------------------------------------------------------
let waitForElements = null;
// -----------------------------------------------------------------------------

{
  // 要素を取得する関数
  function getElements() {
    const res = {
      status: "",
      elements: null
    };
    // 使用する要素が追加されるまで待機
    const elements = {};
    for (const selector of waitForElementsSelectors) {
      elements[selector] = document.querySelector(selector);
      if (!elements[selector]) {
        console.debug(`Waiting for ${selector}...`);
        res.status = "waiting";
        return res;
      }
    }
    // サイズに0が設定されている場合は待機
    const nicoVideoElement = document.querySelector(nicoVideoElementSelector);
    if (nicoVideoElement.videoWidth === 0 || nicoVideoElement.videoHeight === 0) {
      // 解消が見込めない場合は諦める
      const r3Element = elements[r3ElementSelector];
      // タブの開きすぎ
      const isTooManyTabsWarningShown =
        !!r3Element?.querySelector('[data-scope="presence"]')
        ?.textContent.includes("複数のタブやウィンドウで動画を視聴しています");
      if (isTooManyTabsWarningShown) {
        res.status = "unavailable";
        console.debug("Too many tabs warning is shown. Elements are unavailable.");
        return res;
      }
      // 有料動画
      const isPaidVideoNoticeShown =
        !!r3Element?.querySelector('h1')?.textContent.includes("有料動画");
      if (isPaidVideoNoticeShown) {
        res.status = "unavailable";
        console.debug("Paid video notice is shown. Elements are unavailable.");
        return res;
      }
      // 解消が見込める場合は待機
      console.debug("Waiting for video size...");
      res.status = "waiting";
      return res;
    }
    const nicoCommentsElement = document.querySelector(nicoCommentsElementSelector);
    if (nicoCommentsElement.width === 0 || nicoCommentsElement.height === 0) {
      console.debug("Waiting for comments canvas size...");
      res.status = "waiting";
      return res;
    }
    // すべての要素が取得できた場合
    res.status = "ready";
    res.elements = elements;
    return res;
  }

  // 準備完了まで待機する処理
  let waitForElementsInterval = null;
  waitForElements = function (callback) {
    // 既に待機中のインターバルがあればクリア
    if (waitForElementsInterval) clearInterval(waitForElementsInterval);
    // インターバルの設定
    const startTime = performance.now()
    let waitForElementsIntervalTime = waitForElementsIntervalTimeMin;
    let waitForElementsLoopCount = 0;
    function intervalFunc() {
      // 要素を取得
      const res = getElements();
      const elements = res.elements;
      // 時間計測
      const now = performance.now();
      const diff = now - startTime;
      // 要素が取得できた場合はコールバックを実行して終了
      if (res.status === "ready") {
        console.debug("Elements are ready.", `Time taken: ${diff} ms`);
        clearInterval(waitForElementsInterval);
        callback(elements);
        return;
      }
      // 要素の取得見込みがない場合は諦める
      if (res.status === "unavailable") {
        console.debug("Elements are unavailable. Cannot proceed.");
        clearInterval(waitForElementsInterval);
        return;
      }
      // 要素がまだ取得できない場合はリトライ
      // assertion
      if (res.status !== "waiting") {
        console.error("Unexpected status:", res.status);
        clearInterval(waitForElementsInterval);
        return;
      }
      // ループ回数をカウント
      waitForElementsLoopCount++;
      // 待機時間の見直しとタイムアウト処理
      if (waitForElementsLoopCount >= waitForElementsIntervalTimeLoopCount) {
        waitForElementsLoopCount = 0;
        // タイムアウト処理
        if (diff > waitForElementsTimeout) {
          console.log("Timeout reached. Elements not found.");
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
          waitForElementsIntervalTime + waitForElementsIntervalTimeStep,
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
