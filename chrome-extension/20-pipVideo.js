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
      console.debug("Stream stopped.");
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
    else if (type === 'srcObject') videoPipElement.srcObject = value;
    else console.warn("Invalid type for video source:", type);
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

  // PIP用のvideo要素のコンテンツを管理
  let currentPipVideoElementData = {
    "nicoVideoElement": null,
    "nicoCommentsElement": null,
    "currentStream": null
  }
  // 前回のPIP動画要素と現在のPIP動画要素が同じかどうかを判定する関数
  function samePipVideoElementData(nicoVideoElement, nicoCommentsElement) {
    if (currentPipVideoElementData.nicoVideoElement === null) return false;
    if (currentPipVideoElementData.nicoCommentsElement === null) return false;
    if (currentPipVideoElementData.currentStream === null) return false;

    if (currentPipVideoElementData.nicoVideoElement !== nicoVideoElement) return false;
    if (currentPipVideoElementData.nicoCommentsElement !== nicoCommentsElement) return false;
    if (currentPipVideoElementData.currentStream !== currentStream) return false;

    return true;
  }
  // PIP用のvideo要素を作成
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
    destroyPipVideoElement();

    // キャンバスを作成
    const canvas = document.createElement('canvas');
    canvas.width = videoPipElement.videoWidth;
    canvas.height = videoPipElement.videoHeight;

    // Streamを作成
    const stream = canvas.captureStream(60);
    setStream(stream);

    // 描画関数
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

  // PIP用のvideo要素を破棄
  function destroyPipVideoElement() {
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
    // PIP用のvideo要素が存在しない場合は実行しない
    if (!videoPipElement) {
      console.warn("Video PIP element does not exist.");
      return;
    }

    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement

    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (nicoCommentsElement === null) {
      console.warn("Nico comments element is null.");
      return;
    }

    // video要素の描画を行う処理
    createPipVideoElement(nicoVideoElement, nicoCommentsElement);

    // PIP用のvideo要素を表示
    videoPipElement.hidden = false;
    videoPipElement.play();

    // 元の映像とコメントを非表示にする
    nicoVideoElement.hidden = true;
    nicoCommentsElement.hidden = true;
  }

  // PIP終了時の処理
  endPip = function (_nicoVideoElement, _nicoCommentsElement) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement

    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (nicoCommentsElement === null) {
      console.warn("Nico comments element is null.");
      return;
    }

    // PIP用のvideo要素が存在しない場合は何もしない
    if (!videoPipElement) {
      console.warn("Video PIP element does not exist.");
      return;
    }

    // 元の映像とコメントを表示
    nicoVideoElement.hidden = false;
    nicoCommentsElement.hidden = false;

    // PIP用のvideo要素を非表示にして停止
    videoPipElement.hidden = true;
    videoPipElement.pause();

    // PIP用のvideo要素を破棄
    destroyPipVideoElement();
  }

  // サムネイルを16:9に変換
  async function makePoster16by9(srcUrl) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous'; // CORS回避
      img.onload = function () {
        const w = img.width;
        const h = img.height;
        const newH = w * 9 / 16;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        const offsetY = (h - newH) / 2;
        ctx.drawImage(img, 0, offsetY, w, newH, 0, 0, w, newH);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  }

  // PIP用のvideo要素の初期化
  initPipVideoElement = function (_r3Element, _nicoVideoElement, _videoPipElement) {
    const r3Element = _r3Element;
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (r3Element === null) {
      console.warn("R3 element is null.");
      return;
    }
    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (videoPipElement === null) {
      console.warn("Video PIP element is null.");
      return;
    }

    // video要素のサムネイル（poster）を設定
    const thumbnail = getVideoThumbnail();
    if (thumbnail) {
      makePoster16by9(thumbnail).then(dataUrl => {
        videoPipElement.setAttribute('poster', dataUrl);
      }).catch(e => {
        console.warn("画像生成失敗", e);
        videoPipElement.setAttribute('poster', thumbnail);
      });
    } else {
      console.warn("Thumbnail not found.");
    }

    // 既にPIP用のvideo要素がある場合は何もしない
    if (document.getElementById(videoPipElement.id)) {
      console.debug("Video element already exists.");
      return;
    }

    // PIP用のvideo要素をDOMに追加
    const r3ParentElement = r3Element.parentElement;
    if (!r3ParentElement) {
      console.warn("R3 parent element is null.");
      return;
    }
    r3Element.insertBefore(videoPipElement, r3Element.firstChild);
    console.debug("Video element for PIP added.");
  }
}
