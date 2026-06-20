// video要素の描画を行う処理の管理

// --- function ----------------------------------------------------------------
let startPip = null;
let endPip = null;
let initPipVideoElement = null;
let preparePip = null;
let requestPip = null;
let showShortsBlackPip = null;
// -----------------------------------------------------------------------------

// --- variable ----------------------------------------------------------------
const videoPipElement = document.createElement('video');
// -----------------------------------------------------------------------------

{
  // Stream管理
  let currentStream = null;
  // stream内の全trackを停止
  function stopStream(stream) {
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => track.stop());
      console.debug("Stream stopped.");
    } else {
      console.warn("Invalid stream, nothing to stop.");
    }
  }
  // 現在のstreamを差し替える（同一なら何もせず、古いstreamは停止）
  function setStream(stream) {
    if (currentStream === stream) return;
    if (currentStream) stopStream(currentStream);
    currentStream = stream;
  }
  // 現在のstreamを停止して破棄
  function clearStream() {
    if (currentStream) stopStream(currentStream);
    currentStream = null;
  }

  // コメント透過の管理
  let currentCommentsOpacity = 1;
  let currentHiddenSourceElements = {
    "nicoVideoElement": null,
    "nicoCommentsElement": null
  };

  // 隠していた元のvideoとcommentを表示に戻し、トラッキングをクリア
  function restoreHiddenSourceElements() {
    if (currentHiddenSourceElements.nicoVideoElement) {
      currentHiddenSourceElements.nicoVideoElement.hidden = false;
    }
    if (currentHiddenSourceElements.nicoCommentsElement) {
      currentHiddenSourceElements.nicoCommentsElement.hidden = false;
    }
    currentHiddenSourceElements = {
      "nicoVideoElement": null,
      "nicoCommentsElement": null
    };
  }

  // 元のvideo/commentを隠してトラッキング
  // 別要素なら先に前回分を戻す
  function hideSourceElements(nicoVideoElement, nicoCommentsElement) {
    const sameVideo = currentHiddenSourceElements.nicoVideoElement === nicoVideoElement;
    const sameComments = currentHiddenSourceElements.nicoCommentsElement === nicoCommentsElement;
    if (!sameVideo || !sameComments) restoreHiddenSourceElements();
    nicoVideoElement.hidden = true;
    nicoCommentsElement.hidden = true;
    currentHiddenSourceElements = {
      "nicoVideoElement": nicoVideoElement,
      "nicoCommentsElement": nicoCommentsElement
    };
  }

  // 要素のcomputed opacityを0..1で取得
  // 取得できなかった場合は1を返す
  function getElementOpacity(element) {
    if (!element) return 1;
    const opacity = Number.parseFloat(window.getComputedStyle(element).opacity);
    if (Number.isNaN(opacity)) return 1;
    return Math.min(1, Math.max(0, opacity));
  }
  // コメントcanvasの現在のopacityをキャッシュに反映
  function updateCommentsOpacityCache(nicoCommentsElement) {
    const nicoCommentsOpacityElement = nicoCommentsElement?.parentElement ?? nicoCommentsElement;
    const nextCommentsOpacity = getElementOpacity(nicoCommentsOpacityElement);
    console.debug("Comments opacity updated:", `${currentCommentsOpacity} -> ${nextCommentsOpacity}`);
    currentCommentsOpacity = nextCommentsOpacity;
  }

  // 親要素のサイズに合わせてvideo要素を整数pxで更新
  function updatePipVideoElementSize(options = {}) {
    // ショート: 元動画コンテナ内に同じコンテンツレイヤーとして重ねる
    // コントローラーや説明欄より前面に出さず、PiP中プレースホルダだけを元動画の場所に出す
    if (options.overlayElement) {
      if (options.overlayMode === 'inline') {
        videoPipElement.style.position = 'absolute';
        videoPipElement.style.left = '0';
        videoPipElement.style.top = '0';
        videoPipElement.style.width = '100%';
        videoPipElement.style.height = '100%';
        videoPipElement.style.zIndex = '1';
      } else {
        const rect = options.overlayElement.getBoundingClientRect();
        videoPipElement.style.position = 'fixed';
        videoPipElement.style.left = `${Math.round(rect.left)}px`;
        videoPipElement.style.top = `${Math.round(rect.top)}px`;
        videoPipElement.style.width = `${Math.max(1, Math.round(rect.width))}px`;
        videoPipElement.style.height = `${Math.max(1, Math.round(rect.height))}px`;
        videoPipElement.style.zIndex = '';
      }
      videoPipElement.style.opacity = '';
      videoPipElement.style.pointerEvents = 'none';
      videoPipElement.style.objectFit = 'contain'; // ポスター(16:9)を縦枠で引き伸ばさない
      return;
    }

    // ショート等、親に追従させない場合（overlayElement未指定時のフォールバック）
    // PIP用videoはbodyに置いたstream保持用で、画面には出さないため1px・透明で隅に逃がす
    if (options.fitToParent === false) {
      videoPipElement.style.position = 'fixed';
      videoPipElement.style.left = '0';
      videoPipElement.style.top = '0';
      videoPipElement.style.width = '1px';
      videoPipElement.style.height = '1px';
      videoPipElement.style.opacity = '0';
      videoPipElement.style.pointerEvents = 'none';
      videoPipElement.style.zIndex = '';
      return;
    }

    // ショート用(fitToParent:false)で付けた隠しスタイルを解除する
    // これがないとショートから16:9へ戻ったときvideoが opacity:0 / position:fixed のまま残り、
    // PiP中プレースホルダ（ポスターの白黒サムネ＋「再生中」表示）が出なくなる
    videoPipElement.style.position = '';
    videoPipElement.style.left = '';
    videoPipElement.style.top = '';
    videoPipElement.style.width = '';
    videoPipElement.style.height = '';
    videoPipElement.style.opacity = '';
    videoPipElement.style.pointerEvents = '';
    videoPipElement.style.objectFit = '';
    videoPipElement.style.zIndex = '';

    // サイズ計算の基準となる親要素を取得
    const parentElement = videoPipElement.parentElement;
    if (!parentElement) return; // 親要素がない場合はスキップ

    // レイアウト後の実サイズを取得し、1px以上の整数値に正規化
    const rect = parentElement.getBoundingClientRect();
    const parentWidth = Math.max(1, Math.floor(rect.width));
    const parentHeight = Math.max(1, Math.floor(rect.height));

    // 16:9を厳密に維持したサイズで調整する方法
    // const scale = Math.floor(Math.min(parentWidth / 16, parentHeight / 9));
    // let width = scale > 0 ? 16 * scale : parentWidth;
    // let height = scale > 0 ? 9 * scale : parentHeight;

    // 親要素の縦横比を誤差なく計算したサイズで調整する方法
    // const gcd = (a, b) => {
    //   let x = a;
    //   let y = b;
    //   while (y !== 0) {
    //     const t = x % y;
    //     x = y;
    //     y = t;
    //   }
    //   return x;
    // };
    // const ratioGcd = gcd(parentWidth, parentHeight);
    // const ratioW = parentWidth / ratioGcd;
    // const ratioH = parentHeight / ratioGcd;
    // const scale = Math.min(
    //   Math.floor(parentWidth / ratioW),
    //   Math.floor(parentHeight / ratioH)
    // );
    // let width = ratioW * scale;
    // let height = ratioH * scale;

    // 親要素に収めながら、キャンバスサイズの縦横比を誤差なく計算したサイズで調整する方法
    const canvasWidth = videoPipCanvasWidth;
    const canvasHeight = videoPipCanvasHeight;
    let width;
    let height;
    if (parentWidth * canvasHeight <= parentHeight * canvasWidth) {
      width = parentWidth;
      height = Math.floor((parentWidth * canvasHeight) / canvasWidth);
    } else {
      height = parentHeight;
      width = Math.floor((parentHeight * canvasWidth) / canvasHeight);
    }

    // サイズが偶数になるように調整
    if (width % 2 !== 0) width += 1;
    if (height % 2 !== 0) height += 1;
    if (width > parentWidth) width = Math.max(1, width - 2);
    if (height > parentHeight) height = Math.max(1, height - 2);

    // サイズ変更
    videoPipElement.style.width = `${width}px`;
    videoPipElement.style.height = `${height}px`;
    console.debug(
      `PiP video size updated: ${width}x${height} ` +
      `(parent: ${parentWidth}x${parentHeight}, ` +
      `canvas: ${canvasWidth}x${canvasHeight})`
    );
  }

  // 親要素サイズの変更監視
  let pipVideoSizeObserver = null;
  function observePipVideoElementSize(options = {}) {
    if (pipVideoSizeObserver) {
      pipVideoSizeObserver.disconnect();
      pipVideoSizeObserver = null;
    }
    // overlayは元動画コンテナ、それ以外は親要素のサイズ変化を監視して追従させる
    // fitToParent:false かつ overlay でもない（1px固定）の場合だけ監視不要
    if (options.fitToParent === false && !options.overlayElement) return;
    const target = options.overlayElement || videoPipElement.parentElement;
    if (!target || !window.ResizeObserver) return;

    pipVideoSizeObserver = new ResizeObserver(() => {
      updatePipVideoElementSize(options);
    });
    pipVideoSizeObserver.observe(target);
  }

  // ウィンドウサイズの変更監視
  let isWindowResizeListenerAttached = false;
  function observePipVideoElementSizeByWindow() {
    if (isWindowResizeListenerAttached) return;
    window.addEventListener('resize', updatePipVideoElementSize);
    isWindowResizeListenerAttached = true;
  }

  // video要素のソース設定
  function setPipVideoSrc(type, value) {
    clearPipVideoElement();
    if (type === 'src') videoPipElement.src = value
    else if (type === 'srcObject') videoPipElement.srcObject = value;
    else console.warn("Invalid type for video source:", type);
  }

  // video要素のソースをクリア
  function clearPipVideoElement() {
    videoPipElement.removeAttribute('src');
    videoPipElement.srcObject = null;
  }

  // video要素の属性を設定
  videoPipElement.id = pipVideoElementId;
  videoPipElement.muted = true;
  videoPipElement.autoplay = true;
  videoPipElement.loop = true;
  videoPipElement.hidden = true;

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
    "canvasWidth": videoPipCanvasWidth,
    "canvasHeight": videoPipCanvasHeight
  }
  // PIP用canvasのサイズ決定
  // ショートはoptionsで縦可変サイズ（getShortsPipCanvasSizeの結果）を渡す
  function resolvePipCanvasSize(nicoCommentsElement, options = {}) {
    return {
      width: options.canvasWidth || videoPipCanvasWidth,
      height: options.canvasHeight || videoPipCanvasHeight
    };
  }

  // 前回のPIP動画要素と現在のPIP動画要素が同じかどうかを判定する関数
  function samePipVideoElementData(nicoVideoElement, nicoCommentsElement, canvasSize) {
    if (currentPipVideoElementData.nicoVideoElement === null) return false;
    if (currentPipVideoElementData.nicoCommentsElement === null) return false;

    if (currentPipVideoElementData.nicoVideoElement !== nicoVideoElement) return false;
    if (currentPipVideoElementData.nicoCommentsElement !== nicoCommentsElement) return false;
    if (currentPipVideoElementData.canvasWidth !== canvasSize.width) return false;
    if (currentPipVideoElementData.canvasHeight !== canvasSize.height) return false;

    return true;
  }
  // PIP用のvideo要素を作成
  function createPipVideoElement(_nicoVideoElement, _nicoCommentsElement, options = {}) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement
    if (nicoVideoElement === null || nicoCommentsElement === null) {
      console.warn("Nico video element or comments element is null.");
      return;
    }
    const canvasSize = resolvePipCanvasSize(nicoCommentsElement, options);
    // 既に作成済みの場合は何もしない
    if (samePipVideoElementData(nicoVideoElement, nicoCommentsElement, canvasSize)) {
      console.debug("Video element already created.");
      videoPipElement.hidden = false;
      videoPipElement.play();
      return;
    }

    // 作成済みのvideo要素があれば破棄
    destroyPipVideoElement();

    // キャンバスを作成
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    // canvasのコンテキストを取得
    const ctx = canvas.getContext('2d');

    // Streamを作成
    const stream = canvas.captureStream();
    setStream(stream);

    // 縦長クランプ時のレターボックス指定
    // false（watch既定）は従来どおりcanvas全面に描画
    const letterbox = options.letterbox === true;

    // 描画関数
    const drawVideo = () => {
      // 別のStreamが設定されている場合は描画を中止
      if (currentStream !== stream) {
        console.debug("Current stream has changed. Stopping drawing.");
        return;
      }

      // canvasをクリア
      ctx.fillStyle = 'black'; // 黒をセット
      ctx.fillRect(0, 0, canvas.width, canvas.height); // 全体を塗りつぶし

      // コンテンツ枠（動画＋コメントを収める枠）
      // letterbox指定時、コメントcanvasの比率をcanvas内にcontainして、クランプで余った領域を黒帯にする
      let boxX = 0;
      let boxY = 0;
      let boxW = canvas.width;
      let boxH = canvas.height;
      if (letterbox && nicoCommentsElement.width > 0 && nicoCommentsElement.height > 0) {
        const contentAspect = nicoCommentsElement.width / nicoCommentsElement.height;
        const canvasAspect = canvas.width / canvas.height;
        if (canvasAspect > contentAspect) {
          boxH = canvas.height;
          boxW = Math.round(boxH * contentAspect);
        } else {
          boxW = canvas.width;
          boxH = Math.round(boxW / contentAspect);
        }
        boxX = Math.round((canvas.width - boxW) / 2);
        boxY = Math.round((canvas.height - boxH) / 2);
      }

      // nicoVideoElementをコンテンツ枠内に中央揃えcontainで描画
      if (nicoVideoElement.videoWidth > 0 && nicoVideoElement.videoHeight > 0) {
        const nicoVideoAspect = nicoVideoElement.videoWidth / nicoVideoElement.videoHeight;
        const boxAspect = boxW / boxH;

        let drawWidth, drawHeight;
        if (nicoVideoAspect > boxAspect) {
          // videoの幅が枠に対して広い場合
          drawWidth = boxW;
          drawHeight = boxW / nicoVideoAspect;
        } else {
          // videoの高さが枠に対して高い場合
          drawHeight = boxH;
          drawWidth = boxH * nicoVideoAspect;
        }
        const offsetX = boxX + (boxW - drawWidth) / 2;
        const offsetY = boxY + (boxH - drawHeight) / 2;

        ctx.drawImage(nicoVideoElement, offsetX, offsetY, drawWidth, drawHeight);
      }

      // nicoCommentsElementをコンテンツ枠いっぱいに描画
      if (nicoCommentsElement.width > 0 && nicoCommentsElement.height > 0) {
        ctx.globalAlpha = currentCommentsOpacity;
        ctx.drawImage(nicoCommentsElement, boxX, boxY, boxW, boxH);
        ctx.globalAlpha = 1;
      }

      // アニメーションを続ける
      requestAnimationFrame(drawVideo);
    };
    drawVideo();

    setPipVideoSrc('srcObject', stream);

    // 作成済みのvideo要素の情報を保存
    currentPipVideoElementData = {
      "nicoVideoElement": nicoVideoElement,
      "nicoCommentsElement": nicoCommentsElement,
      "canvasWidth": canvas.width,
      "canvasHeight": canvas.height
    };
    console.debug("Video element for PIP created.");
  }

  // PIP用のvideo要素を破棄
  function destroyPipVideoElement(options = {}) {
    if (options.restoreSourceElements !== false) restoreHiddenSourceElements();
    clearStream();
    // WARNING: currentCommentsOpacityはクリアしてはいけない
    // この直前で更新しているパターンがあるので、クリアすると次のイベントまでコメントの透過が効かない
    currentPipVideoElementData = {
      "nicoVideoElement": null,
      "nicoCommentsElement": null,
      "canvasWidth": videoPipCanvasWidth,
      "canvasHeight": videoPipCanvasHeight
    };
  }

  preparePip = function (_nicoVideoElement, _nicoCommentsElement, options = {}) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement;

    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (nicoCommentsElement === null) {
      console.warn("Nico comments element is null.");
      return;
    }

    updateCommentsOpacityCache(nicoCommentsElement);
    createPipVideoElement(nicoVideoElement, nicoCommentsElement, options);
    videoPipElement.play();
  }

  // PIP開始時の処理
  startPip = function (_nicoVideoElement, _nicoCommentsElement, options = {}) {
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

    // コメント透過のキャッシュを更新
    updateCommentsOpacityCache(nicoCommentsElement);

    // video要素の描画を行う処理
    createPipVideoElement(nicoVideoElement, nicoCommentsElement, options);

    // PIP用のvideo要素を表示
    videoPipElement.hidden = false;
    videoPipElement.play();

    // 元の映像とコメントを非表示にする
    hideSourceElements(nicoVideoElement, nicoCommentsElement);
  }

  // PIP終了時の処理
  // WARNING: stream停止・PiP video非表示・隠したsourceの復元は、現在DOMに依存せず必ず実施
  // 広告等でactiveがvideo/commentを持たない状態でPiP終了しても、streamやhidden=falseの残骸を残さない
  // 引数は任意（無ければ復元はトラッキング分のみ）
  endPip = function (_nicoVideoElement, _nicoCommentsElement) {
    const nicoVideoElement = _nicoVideoElement;
    const nicoCommentsElement = _nicoCommentsElement

    // 前回隠したsourceを戻す
    restoreHiddenSourceElements();

    // PIP用のvideo要素が存在しない場合は何もしない
    if (!videoPipElement) {
      console.warn("Video PIP element does not exist.");
      return;
    }

    // 現在のactive要素が渡された場合だけ、その表示も戻す（ショートの広告表示中等ではnullになり得る）
    if (nicoVideoElement) nicoVideoElement.hidden = false;
    if (nicoCommentsElement) nicoCommentsElement.hidden = false;

    // PIP用のvideo要素を非表示にして停止
    videoPipElement.hidden = true;
    videoPipElement.pause();

    // PIP用のvideo要素を破棄
    destroyPipVideoElement();
  }

  // ショートの広告等、activeに動画が無いときはPiPを黒一色にする（PiPは維持）
  // pipActiveは維持して、次に通常ショートへ戻った際、通常の合成へ作り直す
  showShortsBlackPip = function () {
    // 既に黒なら作り直さない（無駄な再生成の回避）
    if (currentPipVideoElementData.black) {
      videoPipElement.hidden = false;
      return;
    }
    // PiPの形が変わらないよう、黒canvasは現在のPiPサイズ（直前のショートの縦横比）に合わせる
    // 取得できなければ既定にフォールバック
    const blackWidth = videoPipElement.videoWidth || videoPipCanvasWidth;
    const blackHeight = videoPipElement.videoHeight || videoPipCanvasHeight;
    // 黒canvasの静止ストリームへ差し替え（前のdrawVideoループはcurrentStream差し替えで自動停止）
    const canvas = document.createElement('canvas');
    canvas.width = blackWidth;
    canvas.height = blackHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(1); // 1fps
    setStream(stream);
    setPipVideoSrc('srcObject', stream);
    videoPipElement.removeAttribute('poster'); // 広告中はポスター不要
    videoPipElement.hidden = false;
    videoPipElement.play();
    // 直前のショートで隠していた元動画/コメントは戻す
    restoreHiddenSourceElements();
    // 次の通常ショートでcreatePipVideoElementが必ず作り直すよう状態をリセット
    currentPipVideoElementData = {
      "nicoVideoElement": null,
      "nicoCommentsElement": null,
      "canvasWidth": blackWidth,
      "canvasHeight": blackHeight,
      "black": true
    };
    console.debug("Shorts PIP set to black (ad / no-media entry).");
  }

  // サムネイルを指定アスペクト比（PiP用video枠=動画の縦横比）のポスターに変換する
  // Chromeはposterのobject-fitを見ないでfill描画するようなので、ポスター画像自体をPiP枠の比率で作る
  const pipPosterCache = new Map();
  const pipPosterCacheMaxSize = 12;
  const pipPosterJpegQuality = 0.82;

  // posterキャッシュへ挿入
  // LRU: 最大数を超えたら最古から削除
  function touchPipPosterCache(key, value) {
    if (pipPosterCache.has(key)) pipPosterCache.delete(key);
    pipPosterCache.set(key, value);
    while (pipPosterCache.size > pipPosterCacheMaxSize) {
      const oldestKey = pipPosterCache.keys().next().value;
      if (!oldestKey) break;
      pipPosterCache.delete(oldestKey);
    }
  }

  // posterキャッシュから取得
  function getPipPosterCache(key) {
    if (!pipPosterCache.has(key)) return null;
    const value = pipPosterCache.get(key);
    pipPosterCache.delete(key);
    pipPosterCache.set(key, value); // ヒットしたら最近使用へ繰り上げ
    return value;
  }

  // posterキャッシュのキーを生成
  function buildPipPosterCacheKey(kind, source, width, height, fit, format) {
    return [
      kind,
      source,
      Math.round(width),
      Math.round(height),
      fit || 'contain',
      format || 'png'
    ].join('|');
  }

  // 画像をcanvasへcontain/coverで中央描画（余白は黒）
  function drawImageToPosterCanvas(ctx, image, targetW, targetH, fit = 'contain') {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetW, targetH);

    const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
    const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return;

    const srcAspect = sourceWidth / sourceHeight;
    const dstAspect = targetW / targetH;
    let drawW, drawH;
    if (fit === 'cover') {
      if (srcAspect > dstAspect) {
        drawH = targetH;
        drawW = targetH * srcAspect;
      } else {
        drawW = targetW;
        drawH = targetW / srcAspect;
      }
    } else {
      if (srcAspect > dstAspect) {
        drawW = targetW;
        drawH = targetW / srcAspect;
      } else {
        drawH = targetH;
        drawW = targetH * srcAspect;
      }
    }

    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;
    ctx.drawImage(image, dx, dy, drawW, drawH);
  }

  // canvasをposter用のdataURLへ変換
  function canvasToPosterDataUrl(canvas, format = 'png') {
    if (format === 'jpeg') {
      return canvas.toDataURL('image/jpeg', pipPosterJpegQuality);
    }
    return canvas.toDataURL('image/png');
  }

  // サムネイルURLを指定枠サイズのposter dataURLに変換
  async function makePosterForBox(srcUrl, targetW, targetH, options = {}) {
    const fit = options.fit || 'contain';
    const format = options.format || 'png';
    const cacheKey = buildPipPosterCacheKey('thumbnail', srcUrl, targetW, targetH, fit, format);
    const cached = getPipPosterCache(cacheKey);
    if (cached) {
      console.debug("PIP poster cache hit.", { cacheKey, kind: 'thumbnail' });
      return cached;
    }

    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous'; // CORS回避
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(targetW));
        canvas.height = Math.max(1, Math.round(targetH));
        const ctx = canvas.getContext('2d');
        drawImageToPosterCanvas(ctx, img, canvas.width, canvas.height, fit);
        const dataUrl = canvasToPosterDataUrl(canvas, format);
        touchPipPosterCache(cacheKey, dataUrl);
        console.debug("PIP poster cached.", { cacheKey, kind: 'thumbnail' });
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  }

  // 要素が属するショート動画のidを取得
  function getShortsEntryIdFromElement(element) {
    return element?.closest('[data-playlist-entry-id]')
      ?.getAttribute('data-playlist-entry-id') || '';
  }

  // 現在activeなショート動画のidを取得
  function getShortsActiveEntryId() {
    return document.querySelector(shortsActiveEntrySelector)
      ?.getAttribute('data-playlist-entry-id') || '';
  }

  // サムネイルURLが期待するショート動画のidのものか判定（id不明なら許容）
  function thumbnailMatchesExpectedEntry(thumbnail, expectedEntryId) {
    if (!thumbnail || !expectedEntryId) return true;
    const numericId = expectedEntryId.replace(/^ss/, '');
    if (!numericId) return true;
    return thumbnail.includes(numericId);
  }

  // active（表示中）のショート動画内のimgから縦長サムネURLを探す
  function getShortsEntryThumbnailUrl(nicoVideoElement, expectedEntryId) {
    const entryElement = nicoVideoElement?.closest('[data-playlist-entry-id]');
    if (!entryElement) return null;

    const entryId = expectedEntryId || getShortsEntryIdFromElement(nicoVideoElement);
    const numericId = entryId.replace(/^ss/, '');
    if (!numericId) return null;

    const images = entryElement.querySelectorAll('img');
    for (const image of images) {
      const src = image.currentSrc || image.src || image.getAttribute('src') || '';
      if (
        src.includes('/nicovideo/thumbnails/') &&
        src.includes(`/${numericId}/`)
      ) {
        return src;
      }
    }

    return null;
  }

  // poster設定の対象が今もactiveな対象動画か（取得後にズレていないか）判定
  function isPipPosterTargetCurrent(nicoVideoElement, expectedEntryId) {
    if (!expectedEntryId) return true;
    return (
      getShortsEntryIdFromElement(nicoVideoElement) === expectedEntryId &&
      getShortsActiveEntryId() === expectedEntryId
    );
  }

  // poster取得をバックオフで再試行
  function schedulePipPosterRetry(nicoVideoElement, options = {}) {
    const retryCount = options.posterRetryCount || 0;
    if (retryCount >= 4) return;

    const delays = [80, 160, 320, 640];
    setTimeout(() => {
      if (!isPipPosterTargetCurrent(nicoVideoElement, options.expectedEntryId)) return;
      updatePipPoster(nicoVideoElement, {
        ...options,
        posterRetryCount: retryCount + 1,
      });
    }, delays[retryCount]);
  }

  // 対象動画のposterを設定
  // ショート動画内サムネ優先、無ければVideoObjectサムネから生成
  function updatePipPoster(nicoVideoElement, options = {}) {
    const posterW = options.canvasWidth || videoPipCanvasWidth;
    const posterH = options.canvasHeight || videoPipCanvasHeight;

    const entryThumbnail = getShortsEntryThumbnailUrl(nicoVideoElement, options.expectedEntryId);
    if (entryThumbnail) {
      videoPipElement.setAttribute('poster', entryThumbnail);
      console.debug("PIP poster set from shorts entry thumbnail.", {
        expectedEntryId: options.expectedEntryId,
        thumbnail: entryThumbnail,
      });
      return;
    }

    // video要素のサムネイル（poster）を設定
    // PiP用video枠（=動画の縦横比）に合わせてポスターを作る
    const thumbnail = getVideoThumbnail();
    if (thumbnail) {
      if (!thumbnailMatchesExpectedEntry(thumbnail, options.expectedEntryId)) {
        videoPipElement.removeAttribute('poster');
        console.debug("PIP poster thumbnail is not current shorts entry yet.", {
          expectedEntryId: options.expectedEntryId,
          thumbnail,
        });
        schedulePipPosterRetry(nicoVideoElement, options);
        return;
      }

      makePosterForBox(thumbnail, posterW, posterH, {
        fit: options.posterFit || 'contain',
        format: options.posterFormat || 'png'
      }).then(dataUrl => {
        if (!isPipPosterTargetCurrent(nicoVideoElement, options.expectedEntryId)) return;
        videoPipElement.setAttribute('poster', dataUrl);
      }).catch(e => {
        console.warn("画像生成失敗", e);
        if (!isPipPosterTargetCurrent(nicoVideoElement, options.expectedEntryId)) return;
        videoPipElement.setAttribute('poster', thumbnail);
      });
    } else {
      console.warn("Thumbnail not found.");
      schedulePipPosterRetry(nicoVideoElement, options);
    }
  }

  // PIP用のvideo要素の初期化
  initPipVideoElement = function (_r3Element, _nicoVideoElement, _videoPipElement, options = {}) {
    // 挿入先: watchはr3Element、ショートはoptions.hostElement（元動画コンテナ）を使う
    const r3Element = options.hostElement || _r3Element;
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

    updatePipPoster(nicoVideoElement, options);

    // 挿入関数: ショート動画（overlay）は元動画コンテナ内へ置き、UIレイヤーより前に出さない
    const insertPipVideoElement = () => {
      if (options.overlayElement) r3Element.appendChild(videoPipElement);
      else r3Element.insertBefore(videoPipElement, r3Element.firstChild);
    };

    // 既にPIP用のvideo要素がある場合
    if (document.getElementById(videoPipElement.id)) {
      if (videoPipElement.parentElement !== r3Element) {
        insertPipVideoElement();
        updatePipVideoElementSize(options);
        observePipVideoElementSize(options);
        console.debug("Video element for PIP moved.");
      } else if (options.overlayElement) {
        // ショート動画（overlay）: アクティブ動画が変わると重ねる位置・サイズが変わるので毎回更新
        updatePipVideoElementSize(options);
        observePipVideoElementSize(options);
      }
      console.debug("Video element already exists.");
      return;
    }

    // PIP用のvideo要素をDOMに追加
    insertPipVideoElement();
    updatePipVideoElementSize(options);  // PiP用のvideo要素のサイズを調整
    observePipVideoElementSize(options); // 動画要素のサイズ変更を検知して随時PiP用のvideo要素を調整
    console.debug("Video element for PIP added.");
  }

  // PIPの要求
  requestPip = function () {
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
}
