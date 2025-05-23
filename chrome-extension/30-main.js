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
            console.log("Video metadata already loaded.");
            videoPipElement.requestPictureInPicture();
            console.log("PIP started.");
          } else {
            console.log("Video metadata not loaded. Waiting for metadata loaded.");
            videoPipElement.addEventListener('loadedmetadata', () => {
              console.log("Video metadata loaded.");
              videoPipElement.requestPictureInPicture();
              console.log("PIP started.");
            });
          }
        }
      });
    };

    initNicoVideoObserver(r5Element);
    initPipVideoElement(r3Element);
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
    waitForElements((elements) => {
      init(elements);
      const currentPiP = document.pictureInPictureElement;
      if (currentPiP === videoPipElement) {
        console.log("PIP is enabled.");
        const nicoVideoElement = elements[nicoVideoElementSelector];
        const nicoCommentsElement = elements[nicoCommentsElementSelector];
        startPip(nicoVideoElement, nicoCommentsElement);
        console.log("PIP video element updated.");
      } else {
        console.log("PIP is disabled.");
      }
    });
  });

  // 初期化処理を実行
  window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
})();
