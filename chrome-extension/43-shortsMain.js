// ニコニコショート用のメイン処理（オーケストレータ）
//
// watch用の30-main.jsと同じグローバルイベントを登録する
// すべて isShortsPage() でゲートしてショート時のみ動作する
// watch側は逆にショートURLで早期returnするため、処理が二重化せずPiPの奪い合いも起きないはず
// 描画処理（20-pipVideo.js）はwatchと共有し、縦可変サイズをoptionsで渡して使う
(function() {
  // ショート用のPIPオプション（コメントcanvas比率の縦可変サイズ）
  // PIP用videoは元動画コンテナ内のコンテンツレイヤーとして重ね、UIレイヤーを隠さない
  function buildPipOptions(elements) {
    const canvasSize = getShortsPipCanvasSize(elements.nicoCommentsElement);
    return {
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      // 縦長クランプ発生時は、動画+コメントをcanvas内のコンテンツ枠にcontainして黒帯で収める
      letterbox: canvasSize.clamped,
      hostElement: elements.pipVideoHostElement,
      overlayElement: elements.overlayElement,
      overlayMode: 'inline',
      posterFit: 'cover',
      posterFormat: 'jpeg',
      expectedEntryId: elements.activeEntryElement?.getAttribute('data-playlist-entry-id') || '',
      fitToParent: false
    };
  }

  // ショートの初期化処理
  // active要素の取得後に配線する
  function init(elements) {
    if (!isShortsPage()) return;
    if (!elements.nicoVideoElement) {
      console.warn("Shorts nico video element not found.");
      return;
    }
    if (!elements.nicoCommentsElement) {
      console.warn("Shorts nico comments element not found.");
      return;
    }
    if (!elements.pipButtonAnchorElement) {
      console.warn("Shorts PIP button anchor element not found.");
      return;
    }

    // PIPボタンのクリックでトグル
    const pipButtonClickCallback = () => {
      waitForShortsElements((elements) => {
        if (document.pictureInPictureElement) {
          console.log("Exiting shorts PIP by button click.");
          document.exitPictureInPicture();
        } else {
          console.log("Entering shorts PIP by button click.");
          init(elements);
          preparePip(
            elements.nicoVideoElement,
            elements.nicoCommentsElement,
            buildPipOptions(elements)
          );
          requestPip();
        }
      });
    };

    const options = buildPipOptions(elements);
    initPipVideoElement(
      elements.pipVideoHostElement,
      elements.nicoVideoElement,
      videoPipElement,
      options
    );
    initShortsPipButtonElement(pipButtonClickCallback, elements.pipButtonAnchorElement);
    updateVideoDataForMediaSession();
    setMediaSession(elements.nicoVideoElement, videoPipElement);
    registerSyncPlaybackStateEvent(elements.nicoVideoElement, videoPipElement);

    // アクティブ切替をdata-playlist-stateの変化で即検知して追従する
    // head/URL監視より早く張り替えるための保険
    initShortsActiveObserver(() => {
      window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
    });
  }

  // ショート動画用のPIP開始イベント
  window.addEventListener('enterpictureinpicture', () => {
    if (!isShortsPage()) return;
    console.log("Enter shorts PIP event.");

    // videoPipElement以外がPIPなら開き直す
    if (document.pictureInPictureElement !== videoPipElement) {
      console.debug("Video PIP element is not in shorts Picture-in-Picture. Opening video PIP element.");
      requestPip();
      return;
    }

    waitForShortsElements((elements) => {
      startPip(
        elements.nicoVideoElement,
        elements.nicoCommentsElement,
        buildPipOptions(elements)
      );
    });
  });

  // ショート動画用のPIP終了イベント
  window.addEventListener('leavepictureinpicture', () => {
    if (!isShortsPage()) return;
    console.log("Leave shorts PIP event.");

    const elements = getShortsActiveElements();
    if (!elements.nicoVideoElement || !elements.nicoCommentsElement) {
      console.warn("Shorts active elements not found on leave PIP; tearing down PIP anyway.");
    }
    endPip(elements.nicoVideoElement, elements.nicoCommentsElement);
  });

  // アクティブ動画が変わったときの処理
  // PIP中なら新しいactive要素へ描画を張り替える
  window.addEventListener(nicoVideoElementChangedEventName, () => {
    if (!isShortsPage()) return;
    console.log("Change shorts video element event.");

    // 広告要素がactiveのとき: PiP中なら黒画面にして次の通常ショートを待つ
    // 誤検知防止のためidプレフィックスで限定する（広告はadsから始まり、ショート動画はssから始まる）
    const activeEntryElement = document.querySelector(shortsActiveEntrySelector);
    const activeEntryId = activeEntryElement?.getAttribute('data-playlist-entry-id') || '';
    if (activeEntryId.startsWith('ads')) {
      console.log("Shorts ad entry active:", activeEntryId);
      if (document.pictureInPictureElement === videoPipElement) {
        showShortsBlackPip();
      }
      return;
    }

    waitForShortsElements((elements) => {
      init(elements);
      if (document.pictureInPictureElement === videoPipElement) {
        console.debug("Shorts PIP is enabled.");
        startPip(
          elements.nicoVideoElement,
          elements.nicoCommentsElement,
          buildPipOptions(elements)
        );
        console.debug("Shorts PIP video element updated.");
      } else {
        console.debug("Shorts PIP is disabled.");
      }
    });
  });

  // URL変更 -> 動画要素変更イベントを発火
  window.addEventListener(nicoVideoPageUrlChangedEventName, () => {
    if (!isShortsPage()) return;
    console.log("Change shorts video page URL event.");
    window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
  });

  // 初期化処理を実行
  window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
})();
