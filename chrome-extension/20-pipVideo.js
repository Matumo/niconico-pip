// video要素の描画を行う処理の管理

// --- function ----------------------------------------------------------------
let startPip = null;
let endPip = null;
let initPipVideoElement = null;
// -----------------------------------------------------------------------------

// --- variable ----------------------------------------------------------------
const videoPipElement = document.createElement('video');
// -----------------------------------------------------------------------------

{
  let currentStream = null;
  function stopStream(stream) {
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => track.stop());
      console.log("Stream stopped.");
    } else {
      console.warn("Invalid stream, nothing to stop.");
    }
  }
  function setStream(stream) {
    if (currentStream) stopStream(currentStream);
    currentStream = stream;
  }
  function clearStream() {
    if (currentStream) stopStream(currentStream);
    currentStream = null;
  }

  let currentAnimationId = null;
  function stopAnimation(id) {
    if (id) cancelAnimationFrame(id);
  }
  function setAnimation(id) {
    if (currentAnimationId) stopAnimation(currentAnimationId);
    currentAnimationId = id;
  }
  function clearAnimation() {
    if (currentAnimationId) stopAnimation(currentAnimationId);
    currentAnimationId = null;
  }

  // video要素のソース設定
  function setPipVideoSrc(type, value) {
    clearPipVideoElement();
    if (type === 'src') videoPipElement.src = value
    if (type === 'srcObject') videoPipElement.srcObject = value;
  }
  function clearPipVideoElement() {
    videoPipElement.src = null;
    videoPipElement.srcObject = null;
  }

  // video要素の属性を設定
  videoPipElement.id = pipVideoElementId;
  videoPipElement.muted = true;
  videoPipElement.autoplay = true;
  videoPipElement.loop = true;
  videoPipElement.style.pointerEvents = 'none';
  videoPipElement.style.objectFit = 'contain';
  videoPipElement.style.width = '100%';
  videoPipElement.style.height = '100%';
  videoPipElement.style.aspectRatio = '16 / 9';
  videoPipElement.style.position = 'absolute';
  videoPipElement.style.transform = 'none';
  videoPipElement.style.top = '0px';
  videoPipElement.style.left = '0px';
  videoPipElement.style.zIndex = '0';
  videoPipElement.style.opacity = '100';

  // ダミーの動画を設定
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = videoPipCanvasWidth;
  dummyCanvas.height = videoPipCanvasHeight;
  const dummyCtx = dummyCanvas.getContext('2d');
  dummyCtx.fillStyle = 'black';
  dummyCtx.fillRect(0, 0, dummyCanvas.width, dummyCanvas.height);
  const dummyStream = dummyCanvas.captureStream(1);
  setPipVideoSrc('srcObject', dummyStream);
  setStream(dummyStream);

  // 描画範囲外でも再生を続ける
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      // videoPipElementであることを確認
      if (entry.target !== videoPipElement) return;
      // videoPipElementが再生中なら何もしない
      if (!videoPipElement.paused) return;
      // videoPipElementを再生
      videoPipElement.play();
      console.log("Video resumed.");
    });
  });
  observer.observe(videoPipElement);

  // PIP用のvideo要素のコンテンツを管理
  let currentPipVideoElementData = {
    "nicoVideoElement": null,
    "nicoCommentsElement": null,
    "currentStream": null
  }
  function samePipVideoElementData(nicoVideoElement, nicoCommentsElement) {
    if (currentPipVideoElementData.nicoVideoElement === null) return false;
    if (currentPipVideoElementData.nicoCommentsElement === null) return false;
    if (currentPipVideoElementData.currentStream === null) return false;

    if (currentPipVideoElementData.nicoVideoElement !== nicoVideoElement) return false;
    if (currentPipVideoElementData.nicoCommentsElement !== nicoCommentsElement) return false;
    if (currentPipVideoElementData.currentStream !== currentStream) return false;

    return true;
  }
  function createPipVideoElement(_nicoVideoElement, _nicoCommentsElement) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement
    if (nicoVideoElement === null || nicoCommentsElement === null) {
      console.warn("Nico video element or comments element is null.");
      return;
    }
    // 既に作成済みの場合は何もしない
    if (samePipVideoElementData(nicoVideoElement, nicoCommentsElement)) {
      console.debug("Video element already created.");
      videoPipElement.hidden = false;
      videoPipElement.play();
      return;
    }

    // 作成済みのvideo要素があれば破棄
    destoryPipVideoElement();

    // video要素を作成
    const canvas = document.createElement('canvas');
    canvas.width = videoPipElement.videoWidth;
    canvas.height = videoPipElement.videoHeight;

    const stream = canvas.captureStream(60);
    setStream(stream);

    const drawVideo = () => {
      const ctx = canvas.getContext('2d');

      // canvasをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // nicoVideoElementを中央揃えで描画
      if (nicoVideoElement.videoWidth > 0 && nicoVideoElement.videoHeight > 0) {
        const nicoVideoAspect = nicoVideoElement.videoWidth / nicoVideoElement.videoHeight;
        const canvasAspect = canvas.width / canvas.height;

        let drawWidth, drawHeight;
        if (nicoVideoAspect > canvasAspect) {
          // videoの幅がcanvasに対して広い場合
          drawWidth = canvas.width;
          drawHeight = canvas.width / nicoVideoAspect;
        } else {
          // videoの高さがcanvasに対して高い場合
          drawHeight = canvas.height;
          drawWidth = canvas.height * nicoVideoAspect;
        }
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;

        ctx.drawImage(nicoVideoElement, offsetX, offsetY, drawWidth, drawHeight);
      }

      // nicoCommentsElementを描画（canvas全体に描画）
      if (nicoCommentsElement.width > 0 && nicoCommentsElement.height > 0) {
        ctx.drawImage(nicoCommentsElement, 0, 0, canvas.width, canvas.height);
      }

      // アニメーションを続ける
      setAnimation(requestAnimationFrame(drawVideo));
    };
    drawVideo();

    setPipVideoSrc('srcObject', stream);

    // 作成済みのvideo要素の情報を保存
    currentPipVideoElementData = {
      "nicoVideoElement": nicoVideoElement,
      "nicoCommentsElement": nicoCommentsElement,
      "currentStream": currentStream
    };
  }
  function destoryPipVideoElement() {
    clearAnimation();
    clearStream();

    currentPipVideoElementData = {
      "nicoVideoElement": null,
      "nicoCommentsElement": null,
      "currentStream": null
    };
  }

  // PIP開始時の処理
  startPip = function (_nicoVideoElement, _nicoCommentsElement) {
    // videoPipElementではなければ何もしない
    if (document.pictureInPictureElement !== videoPipElement) {
      console.debug("Other element is in Picture-in-Picture.");
      return;
    }

    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement

    if (nicoVideoElement === null) {
      console.error("Nico video element is null.");
      return;
    }
    if (nicoCommentsElement === null) {
      console.error("Nico comments element is null.");
      return;
    }

    // video要素の描画を行う処理
    createPipVideoElement(nicoVideoElement, nicoCommentsElement);

    // video要素を表示して再生
    videoPipElement.hidden = false;
    videoPipElement.play();

    nicoVideoElement.hidden = true;
    nicoCommentsElement.hidden = true;
  }

  // PIP終了時の処理
  endPip = function (_nicoVideoElement, _nicoCommentsElement) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement

    if (nicoVideoElement === null) {
      console.error("Nico video element is null.");
      return;
    }
    if (nicoCommentsElement === null) {
      console.error("Nico comments element is null.");
      return;
    }

    nicoVideoElement.hidden = false;
    nicoCommentsElement.hidden = false;

    videoPipElement.hidden = true;
    videoPipElement.pause();

    destoryPipVideoElement();
  }

  // PIP用のvideo要素の初期化
  initPipVideoElement = function (_r3Element) {
    const r3Element = _r3Element;
    if (r3Element === null) {
      console.error("R3 element is null.");
      return;
    }

    // 既にPIP用のvideo要素がある場合は何もしない
    if (document.getElementById(videoPipElement.id)) {
      console.debug("Video element already exists.");
      return;
    }

    // PIP用のvideo要素をDOMに追加
    const r3ParentElement = r3Element.parentElement;
    if (!r3ParentElement) {
      console.error("R3 parent element is null.");
      return;
    }
    r3ParentElement.insertBefore(videoPipElement, r3Element);
    console.debug("Video element for PIP added.");
  }
}
