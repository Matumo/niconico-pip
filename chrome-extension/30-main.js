(function() {
  // 初期化処理
  function init(elements) {
    // elementsの内容を確認
    for (const key of waitForElementsSelectors) {
      if (!elements[key]) {
        console.warn(`Element not found: ${key}`);
        return;
      }
    }

    // ニコニコ動画のvideo要素
    const nicoVideoElement = elements[nicoVideoElementSelector];
    // ニコニコ動画のコメントキャンバス要素
    const nicoCommentsElement = elements[nicoCommentsElementSelector];
    // r3要素
    const r3Element = elements[r3ElementSelector];
    // r5要素
    const r5Element = elements[r5ElementSelector];
    // tooltipButton要素
    const tooltipButtonElement = elements[tooltipButtonElementSelector];

    const pipButtonClickCallback = () => {
      waitForElements((elements) => {
        if (document.pictureInPictureElement) {
          // ボタンクリックによるPIPの終了
          console.log("Exiting PIP by button click.");
          document.exitPictureInPicture();
        } else {
          // ボタンクリックによるPIPの開始
          console.log("Entering PIP by button click.");
          // 初期化処理
          init(elements);
          // メタデータ読み込みが完了してからPIPを開始
          if (videoPipElement.readyState >= 1) {
            console.debug("Video metadata already loaded.");
            videoPipElement.requestPictureInPicture();
            console.debug("PIP started.");
          } else {
            console.debug("Video metadata not loaded. Waiting for metadata loaded.");
            videoPipElement.addEventListener('loadedmetadata', () => {
              console.debug("Video metadata loaded.");
              videoPipElement.requestPictureInPicture();
              console.debug("PIP started.");
            });
          }
        }
      });
    };

    initNicoVideoObserver(r5Element);
    initPipVideoElement(r3Element, nicoVideoElement, videoPipElement);
    initPipButtonElement(pipButtonClickCallback, tooltipButtonElement);
    updateVideoDataForMediaSession();
    setMediaSession(nicoVideoElement, videoPipElement);
    registerSyncPlaybackStateEvent(nicoVideoElement, videoPipElement);
  }

  // PIP開始のイベントリスナーを登録
  window.addEventListener('enterpictureinpicture', (event) => {
    console.log("Entery PIP event.");

    const nicoVideoElement = document.querySelector(nicoVideoElementSelector);
    if (!nicoVideoElement) {
      console.warn("Nico video element not found.");
      return;
    }

    const nicoCommentsElement = document.querySelector(nicoCommentsElementSelector);
    if (!nicoCommentsElement) {
      console.warn("Nico comments element not found.");
      return;
    }

    startPip(nicoVideoElement, nicoCommentsElement);
  });

  // PIP終了のイベントリスナーを登録
  window.addEventListener('leavepictureinpicture', (event) => {
    console.log("Leave PIP event.");

    const nicoVideoElement = document.querySelector(nicoVideoElementSelector);
    if (!nicoVideoElement) {
      console.warn("Nico video element not found.");
      return;
    }

    const nicoCommentsElement = document.querySelector(nicoCommentsElementSelector);
    if (!nicoCommentsElement) {
      console.warn("Nico comments element not found.");
      return;
    }

    endPip(nicoVideoElement, nicoCommentsElement);
  });

  // 動画が変更されたときのイベントリスナーを登録
  window.addEventListener(nicoVideoElementChangedEventName, () => {
    console.log("Change nico video element event.");
    // 正規表現を使ってURLが動画再生ページかどうかを確認
    const url = window.location.href;
    if (!nicoVideoPageUrlPatternRegExp.test(url)) {
      console.debug("Not a Nico video page. Skipping initialization.");
      // videoPipElementがPiP状態であれば終了
      if (document.pictureInPictureElement === videoPipElement) {
        console.debug("Exiting PIP because not a Nico video page.");
        document.exitPictureInPicture();
      }
      return;
    }
    // 要素の取得と初期化処理を実行
    console.debug("Nico video page detected. Initializing...");
    waitForElements((elements) => {
      init(elements);
      const currentPiP = document.pictureInPictureElement;
      if (currentPiP === videoPipElement) {
        console.debug("PIP is enabled.");
        const nicoVideoElement = elements[nicoVideoElementSelector];
        const nicoCommentsElement = elements[nicoCommentsElementSelector];
        startPip(nicoVideoElement, nicoCommentsElement);
        console.debug("PIP video element updated.");
      } else {
        console.debug("PIP is disabled.");
      }
    });
  });

  // URLが変更されたときのイベントリスナーを登録
  window.addEventListener(nicoVideoPageUrlChangedEventName, () => {
    console.log("Change nico video page URL event.");
    // とりあえず動画要素の変更イベントを発火（動画再生ページであるかどうかはイベントハンドラに判断させる）
    window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
  });

  // bodyに対してラジオボタンの変更を監視
  document.body.addEventListener('change', (event) => {
    // 動画プレイヤー設定の「コントローラーを常に表示」を切り替えた際にPIPボタンを再描画するための処理
    if (event.target.matches('input[type="radio"]')) {
      console.debug("Radio button changed. Redrawing PIP button.");
      // PIPボタンを再描画するためにイベントを発火
      window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
    }
  });

  // 初期化処理を実行
  window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
})();
