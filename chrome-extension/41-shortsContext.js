// ニコニコショート用の要素取得

// --- function ----------------------------------------------------------------
let isShortsPage = null;
let getShortsActiveElements = null;
let getShortsPipCanvasSize = null;
let waitForShortsElements = null;
let initShortsActiveObserver = null;
// -----------------------------------------------------------------------------

{
  // ショート動画ページかどうかを判定
  isShortsPage = function() {
    return nicoShortsPageUrlPatternRegExp.test(window.location.href);
  }

  // 偶数に丸める（captureStream用canvasは偶数pxが無難）
  function even(value) {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  // PIP用canvasのサイズをコメントcanvasの縦横比から算出
  // 短辺をshortsPipCanvasBaseSizeに固定し、長辺を比率で伸ばす（1:1〜縦長の可変対応）
  getShortsPipCanvasSize = function(_nicoCommentsElement) {
    const nicoCommentsElement = _nicoCommentsElement;
    const sourceWidth = nicoCommentsElement?.width || shortsPipCanvasBaseSize;
    const sourceHeight = nicoCommentsElement?.height || shortsPipCanvasBaseSize;
    const trueAspect = sourceWidth / sourceHeight;

    // 縦長クランプ: 真比がクランプ下限より縦長(=小さい)なら、窓が縦に伸びすぎないよう比を頭打ちにする
    // クランプした分は、コンテンツをcanvas内にcontain（左右黒帯）して収める（letterbox は描画側で処理）
    const minAspect = shortsPipMinAspectRatio > 0 ? shortsPipMinAspectRatio : 0;
    const clamped = minAspect > 0 && trueAspect < minAspect;
    const aspect = clamped ? minAspect : trueAspect;

    if (aspect >= 1) {
      // 横長動画 or 正方形
      return {
        width: even(shortsPipCanvasBaseSize * aspect),
        height: shortsPipCanvasBaseSize,
        clamped
      };
    }

    // 縦長動画
    return {
      width: shortsPipCanvasBaseSize,
      height: even(shortsPipCanvasBaseSize / aspect),
      clamped
    };
  }

  // アクティブなショート動画配下から各要素を取得
  // WARNING: ショート動画はvideo/コメントcanvasが複数同時に存在する
  // 素のdocument.querySelectorは非アクティブな先頭要素を返すことがあるので、必ずactiveなショート動画配下で取得する
  // PIP用videoは元動画コンテナ内に置き、コントローラー等のUIレイヤーより前に出さない
  getShortsActiveElements = function() {
    const activeEntryElement = document.querySelector(shortsActiveEntrySelector);
    const nicoVideoElement =
      activeEntryElement?.querySelector(nicoVideoElementSelector) || null;
    const nicoCommentsElement =
      activeEntryElement?.querySelector(nicoCommentsElementSelector) || null;
    // コメントトグルを最優先し、無ければ再生/一時停止を代替アンカーにする
    // querySelectorをコンマ区切りで実行するとDOM順の先頭を返すため、優先順位は2段構えで担保する
    const pipButtonAnchorElement =
      activeEntryElement?.querySelector(shortsPipButtonAnchorSelector) ||
      activeEntryElement?.querySelector(shortsPipButtonAnchorFallbackSelector) ||
      null;

    return {
      activeEntryElement,
      nicoVideoElement,
      nicoCommentsElement,
      pipButtonAnchorElement,
      pipVideoHostElement: nicoVideoElement?.parentElement || document.body,
      // PIP中プレースホルダ（ポスター）を元動画の位置に出すための基準となる要素
      // 元動画の親（[data-name="content"]）はPIP中も非表示にならず可視なので基準に使える
      overlayElement: nicoVideoElement?.parentElement || null,
    };
  }

  // アクティブ動画の切替をdata-playlist-stateの変化で即検知する監視
  // 既存のhead/URL監視より早く反応できるので、追従の検知遅延を減らせる
  // 監視対象はショート動画を束ねるtranslateYストリップ（アクティブなショート動画の親）
  let shortsActiveObserver = null;
  let shortsActiveObserverTarget = null;
  let lastObservedActiveId = null;
  initShortsActiveObserver = function(onActiveChange) {
    const active = document.querySelector(shortsActiveEntrySelector);
    const target = active?.parentElement || null;
    if (!target || !window.MutationObserver) return;
    // 同じ対象に既に張っていれば二重設定しない
    if (shortsActiveObserver && shortsActiveObserverTarget === target) return;
    if (shortsActiveObserver) shortsActiveObserver.disconnect();
    shortsActiveObserverTarget = target;
    lastObservedActiveId = active?.getAttribute('data-playlist-entry-id') || null;
    shortsActiveObserver = new MutationObserver(() => {
      const a = document.querySelector(shortsActiveEntrySelector);
      const id = a?.getAttribute('data-playlist-entry-id') || null;
      // アクティブIDが実際に変わったときだけ通知（standby <-> activeのノイズを除去）
      if (id && id !== lastObservedActiveId) {
        lastObservedActiveId = id;
        console.debug("Shorts active entry changed (observer).", id);
        onActiveChange();
      }
    });
    shortsActiveObserver.observe(target, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-playlist-state'],
    });
    console.debug("Shorts active observer initialized.");
  };

  // ショート版の要素準備チェック
  // active配下の要素がそろい、サイズが確定するまで待つ
  function getElements() {
    const res = {
      status: "",
      elements: null
    };

    const elements = getShortsActiveElements();
    if (!elements.activeEntryElement) {
      console.debug("Waiting for shorts active entry...");
      res.status = "waiting";
      return res;
    }
    if (!elements.nicoVideoElement) {
      console.debug("Waiting for shorts video...");
      res.status = "waiting";
      return res;
    }
    if (!elements.nicoCommentsElement) {
      console.debug("Waiting for shorts comments canvas...");
      res.status = "waiting";
      return res;
    }
    if (!elements.pipButtonAnchorElement) {
      console.debug("Waiting for shorts PIP button anchor...");
      res.status = "waiting";
      return res;
    }
    if (
      elements.nicoVideoElement.videoWidth === 0 ||
      elements.nicoVideoElement.videoHeight === 0
    ) {
      console.debug("Waiting for shorts video size...");
      res.status = "waiting";
      return res;
    }
    if (
      elements.nicoCommentsElement.width === 0 ||
      elements.nicoCommentsElement.height === 0
    ) {
      console.debug("Waiting for shorts comments canvas size...");
      res.status = "waiting";
      return res;
    }

    res.status = "ready";
    res.elements = elements;
    return res;
  }

  // ショート版の準備完了待ち（11-wait.jsのショート相当、バックオフでポーリング）
  let waitForShortsElementsInterval = null;
  waitForShortsElements = function(callback) {
    if (waitForShortsElementsInterval) clearInterval(waitForShortsElementsInterval);

    const startTime = performance.now();
    let intervalTime = waitForElementsIntervalTimeMin;
    let loopCount = 0;

    function intervalFunc() {
      const res = getElements();
      const now = performance.now();
      const diff = now - startTime;

      if (res.status === "ready") {
        console.debug("Shorts elements are ready.", `Time taken: ${diff} ms`);
        clearInterval(waitForShortsElementsInterval);
        callback(res.elements);
        return;
      }

      if (res.status !== "waiting") {
        console.error("Unexpected shorts wait status:", res.status);
        clearInterval(waitForShortsElementsInterval);
        return;
      }

      loopCount++;
      if (loopCount >= waitForElementsIntervalTimeLoopCount) {
        loopCount = 0;
        if (diff > waitForElementsTimeout) {
          console.log("Timeout reached. Shorts elements not found.");
          clearInterval(waitForShortsElementsInterval);
          return;
        }

        if (intervalTime === waitForElementsIntervalTimeMax) return;
        intervalTime = Math.min(
          intervalTime + waitForElementsIntervalTimeStep,
          waitForElementsIntervalTimeMax
        );
        console.debug(`Adjusting shorts wait interval to ${intervalTime} ms.`);
        clearInterval(waitForShortsElementsInterval);
        waitForShortsElementsInterval = setInterval(intervalFunc, intervalTime);
      }
    }

    console.debug(`Starting wait for shorts elements with interval ${intervalTime} ms.`);
    waitForShortsElementsInterval = setInterval(intervalFunc, intervalTime);
  }
}
