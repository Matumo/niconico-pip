"use strict";

// PIP動画の描画処理

// --- functions ---------------------------------------------------------------
let drawPip = null;
// -----------------------------------------------------------------------------

{
  // 描画リセット
  function clear(ctx) {
    // 黒に塗りつぶす
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, videoPipCanvasWidth, videoPipCanvasHeight);
    return true; // 描画成功
  }

  // 動画の有効性チェック
  function isValidVideoElement(videoElement) {
    if (!videoElement) return false;
    if (videoElement.readyState < 2) return false; // HAVE_CURRENT_DATA
    if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) return false;
    return true;
  }

  // キャンバスの有効性チェック
  function isValidCanvasElement(canvasElement) {
    if (!canvasElement) return false;
    if (canvasElement.width <= 0 || canvasElement.height <= 0) return false
    return true;
  }

  // コメント描画
  function drawComments(ctx) {
    const nicoCommentsElement = context.elements.menu.comments;
    if (!isValidCanvasElement(nicoCommentsElement)) return false; // 描画失敗
    // nicoCommentsElementを描画（canvas全体に描画）
    ctx.drawImage(nicoCommentsElement, 0, 0, videoPipCanvasWidth, videoPipCanvasHeight);
    return true; // 描画成功
  }

  // デバッグ情報を描画
  function drawDebug(ctx) {
    // ステータスを描画
    const status = context.status;
    const fontSize = 40;
    ctx.fillStyle = 'white';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillText(`Status: ${status.type || 'unknown'}`, 10, fontSize);
    ctx.fillText(`Playing: ${status.playing ? 'Yes' : 'No'}`, 10, fontSize * 2);
    ctx.fillText(`Details: ${status.details || 'None'}`, 10, fontSize * 3);
    const now = performance.now();
    ctx.fillText(`Time: ${now.toFixed(2)} ms`, 10, fontSize * 4);
    return true; // 描画成功
  }

  // 動画をキャンバスの中央に描画するための位置計算
  function calcDrawPosition(_videoElement, _canvasWidth, _canvasHeight) {
    const videoElement = _videoElement;

    // キャンバスの幅と高さを取得
    const canvasWidth = _canvasWidth;
    const canvasHeight = _canvasHeight;
    // 動画の幅と高さを取得
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    // 動画のアスペクト比とキャンバスのアスペクト比を計算
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    // 描画サイズを計算
    let drawWidth, drawHeight;
    if (videoAspect > canvasAspect) {
      // 動画の幅がキャンバスに対して広い場合
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / videoAspect;
    } else {
      // 動画の高さがキャンバスに対して高い場合
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * videoAspect;
    }
    // 描画開始位置を計算
    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;

    return { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight };
  }

  // 動画を描画
  function drawVideo(ctx) {
    const videoElement = context.elements.menu.video;
    if (!isValidVideoElement(videoElement)) return false; // 描画失敗
    // 描画位置を計算
    const { x, y, width, height } =
      calcDrawPosition(videoElement, videoPipCanvasWidth, videoPipCanvasHeight);
    // 描画
    ctx.drawImage(videoElement, x, y, width, height);
    // バッファ不足で動画が再生されていない場合はfalseを返す
    if (videoElement.readyState < 3) return false; // 描画失敗
    return true; // 描画成功
  }

  // ニコニ貢献を描画
  function drawSupporter(ctx) {
    const supporterCanvasElement = context.elements.menu.supporterCanvas;
    if (!isValidCanvasElement(supporterCanvasElement)) return false; // 描画失敗
    // 描画
    ctx.drawImage(supporterCanvasElement, 0, 0, videoPipCanvasWidth, videoPipCanvasHeight);
    // ロゴ描画
    const logo = getNicoSupporterLogo();
    if (logo) {
      const logoWidth = logo.width;
      const logoHeight = logo.height;
      // 上に横いっぱいに半透明の黒背景を描画
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // 半透明の黒
      ctx.fillRect(0, 0, videoPipCanvasWidth, logoHeight + 20); // 10pxの余白を追加
      // ロゴを左上に描画
      const logoX = 15; // 左からのオフセット
      const logoY = 10; // 上からのオフセット
      ctx.globalAlpha = 1.0; // 不透明度を元に戻す
      ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
    }
    return true; // 描画成功
  }

  let lastAdURL = null; // 最後に描画した広告のURL
  function resetAndReplayVideo(video) {
    if (!(video instanceof HTMLVideoElement)) {
      console.warn("resetAndReplayVideo: Not a valid HTMLVideoElement.");
      return;
    }
    const src = video.currentSrc || video.src;

    video.pause();
    video.currentTime = 0;

    // 必ず anonymous に上書き
    video.crossOrigin = "anonymous";
    // srcを再セット
    video.src = src;
    video.load();
    video.play().catch((error) => {
      console.debug("Failed to replay ad video:", error);
    });
  }

  function drawTextLogo(ctx, text, fillStyle) {
    const fontSize = 28;
    ctx.font = `${fontSize}px ${fontFamily}`;
    const textWidth = ctx.measureText(text).width;
    const paddingX = 14;
    const paddingY = 8;
    const bgWidth = textWidth + paddingX * 2;
    const bgHeight = fontSize + paddingY * 2;
    const bgLeft = 10; // 左端から10px
    const bgTop = ctx.canvas.height - bgHeight - 10; // 下端から10px上
    const radius = 12;
    ctx.beginPath();
    ctx.moveTo(bgLeft + radius, bgTop);
    ctx.lineTo(bgLeft + bgWidth - radius, bgTop);
    ctx.arcTo(bgLeft + bgWidth, bgTop, bgLeft + bgWidth, bgTop + radius, radius);
    ctx.lineTo(bgLeft + bgWidth, bgTop + bgHeight - radius);
    ctx.arcTo(bgLeft + bgWidth, bgTop + bgHeight, bgLeft + bgWidth - radius, bgTop + bgHeight, radius);
    ctx.lineTo(bgLeft + radius, bgTop + bgHeight);
    ctx.arcTo(bgLeft, bgTop + bgHeight, bgLeft, bgTop + bgHeight - radius, radius);
    ctx.lineTo(bgLeft, bgTop + radius);
    ctx.arcTo(bgLeft, bgTop, bgLeft + radius, bgTop, radius);
    ctx.closePath();
    ctx.fillStyle = fillStyle || 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.fillStyle = 'black'; // 文字色
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bgLeft + paddingX, bgTop + bgHeight / 2); // テキストの描画
    return true; // 描画成功
  }

  // 広告を描画
  function drawAd(ctx) {
    const adElementList = context.elements.ad.adVideo;
    const adIndex = context.status.index;
    if (!adElementList || adIndex < 0 || adIndex >= adElementList.length) return false; // 描画失敗
    const adVideoElement = adElementList[adIndex];
    // CORS対策
    if (!adVideoElement.crossOrigin || adVideoElement.crossOrigin !== "anonymous") {
      if (!lastAdURL || lastAdURL !== adVideoElement.currentSrc) {
        resetAndReplayVideo(adVideoElement);
        lastAdURL = adVideoElement.currentSrc || adVideoElement.src;
      }
      return false; // 描画失敗
    }
    // adElementが存在しない、またはサイズが無効な場合は何もしない
    if (!isValidVideoElement(adVideoElement)) return false; // 描画失敗
    // 描画位置を計算
    const { x, y, width, height } =
      calcDrawPosition(adVideoElement, videoPipCanvasWidth, videoPipCanvasHeight);
    // 描画
    ctx.drawImage(adVideoElement, x, y, width, height);
    // 説明文
    const status = context.status;
    const text = status.type === "ad-nico" ? 'いきなり動画紹介' : '広告';
    drawTextLogo(ctx, text, 'rgba(255, 255, 0, 0.9)'); // 黄色背景
    // バッファ不足で動画が再生されていない場合はfalseを返す
    if (adVideoElement.readyState < 3) return false; // 描画失敗
    return true; // 描画成功
  }

  let lastUpdateProgressValue = -1;
  let lastUpdateProgressTime = 0;
  const maxProgressTime = 8 * 1000; // 8秒かけて100%になる進捗バー

  // 次の動画紹介を描画
  function drawNextVideo(ctx) {
    // a要素
    const link = context.elements.nextVideo.nextVideoLink;
    // img要素
    const thumbnail = context.elements.nextVideo.nextVideoThumbnail;
    // altから動画のタイトルを取得
    const title = thumbnail.alt || "";
    const remainingTimeElement = context.elements.nextVideo.nextVideoRemainingTime;
    // 次の動画に遷移する残り時間のテキストを取得
    const remainingTime = remainingTimeElement.textContent || "";
    // 進捗を取得
    const progressElement = context.elements.nextVideo.nextVideoProgress;
    // progress値（aria-label）を取得
    const progressValueText = progressElement.getAttribute('aria-label') || -1;
    let _progressValue = -1;
    if (progressValueText) {
      // 数値に変換
      try {
        _progressValue = parseFloat(progressValueText);
        // 進捗バーの更新を記録
        const now = performance.now();
        if (lastUpdateProgressValue !== _progressValue) {
          lastUpdateProgressValue = _progressValue;
          lastUpdateProgressTime = now;
        }
        // 進捗バーの差分を計算して加算することで滑らかに動かす
        // 進捗バーが初期状態（値が0）の場合は何もしない
        if (_progressValue > 0) {
          const elapsedTime = now - lastUpdateProgressTime;
          // 加算する進捗バーの値を計算（加算しすぎないように制限）
          const progressIncrement = (100.0 / maxProgressTime) * Math.min(elapsedTime, 200);
          //console.debug("Progress value:", _progressValue, "Increment:", progressIncrement, "elapsedTime:", elapsedTime);
          _progressValue += progressIncrement;
        }
        // 100%を超えないように制限
        if (_progressValue > 100) _progressValue = 100;
      } catch (e) {
        if (debugMode) console.error("Failed to parse progress value:", e);
        _progressValue = -1; // 変換失敗時は-1にする
      }
    }
    // 進捗値が無効な場合は0に設定
    const progressValue = isNaN(_progressValue) ? 0 : _progressValue;

    // 白背景
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, videoPipCanvasWidth, videoPipCanvasHeight);

    // テキストロゴを描画
    drawTextLogo(ctx, '次の動画', 'rgba(220, 235, 255, 0.85)'); // 優しい青系背景

    // タイトルを描画
    // 上下は中央に、左右はキャンバスの中央から描画を開始する
    ctx.fillStyle = 'black';
    ctx.font = `45px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const titleX = 40; // 左からのオフセット
    const titleY = 80; // 上からのオフセット
    ctx.fillText(title, titleX, titleY, videoPipCanvasWidth - titleX * 2); // キャンバスの幅に合わせて描画
    // 残り時間を描画
    ctx.font = `35px ${fontFamily}`;
    ctx.textBaseline = 'top'; // テキストの基準線を上に設定
    const remainingTimeX = titleX; // 左からのオフセット
    const remainingTimeY = titleY + 90; // タイトルの下に配置
    ctx.fillText(remainingTime, remainingTimeX, remainingTimeY, videoPipCanvasWidth - remainingTimeX * 2); // キャンバスの幅に合わせて描画
    // 進捗をバーで描画
    const progressBarX = titleX; // 左からのオフセット
    const progressBarY = remainingTimeY + 50; // 残り時間の下に配置
    const progressBarWidth = videoPipCanvasWidth - progressBarX * 2; // キャンバスの幅に合わせて描画
    const progressBarHeight = 10; // バーの高さ
    // バーの背景
    ctx.fillStyle = '#eee'; // 薄いグレー
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    // 進捗バーの色
    const progressBarColor = progressValue < 100 ? '#217cf3' : '#4caf50'; // 青色または緑色
    // 進捗バーの描画
    ctx.fillStyle = progressBarColor;
    const progressBarFilledWidth = (progressValue / 100) * progressBarWidth; // 進捗に応じた幅
    ctx.fillRect(progressBarX, progressBarY, progressBarFilledWidth, progressBarHeight);

    // サムネイル（img要素）を描画
    if (thumbnail && link) {
      // 次の動画のサムネイルを取得
      const thumbnailData = getNicoVideoThumbnailImage(link.href);
      // サムネイルは取得時にサイズ変換されているため、canvasをそのまま描画する
      if (thumbnailData && thumbnailData instanceof HTMLCanvasElement) {
        // 左からのオフセットは、キャンバスの左半分で中央に配置
        const thumbnailX = (videoPipCanvasWidth / 4) - (thumbnailData.width / 2);
        // 上からのオフセットは、進捗バーの下に配置
        const thumbnailY = progressBarY + progressBarHeight + 70;
        // 描画
        ctx.drawImage(thumbnailData, thumbnailX, thumbnailY);
        // 広告枠が存在する場合は、サムネイル画像に広告枠を描画
        const nextVideo = context.elements.nextVideo.nextVideo;
        const adBox = nextVideo?.querySelector(':scope' + selector_player_nextVideo_adBox_suffix);
        if (adBox) {
          const diff = -12;
          ctx.drawImage(adBox, thumbnailX + diff, thumbnailY + diff, 150, 150);
        }
      }
    }

    if (progressValue === 100) return false; // 次の動画に遷移するのでロード円を描画する
    return true; // 描画成功
  }

  // ロード中の円を描画
  const radius = 30;
  const cx = videoPipCanvasWidth / 2;
  const cy = videoPipCanvasHeight / 2;
  let angle = 0;
  function drawLoadingCircle(ctx, color = '#217cf3') {
    angle += 0.08;
    // 薄いグレーで全円
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 8;
    ctx.stroke();
    // 回転部分（青色）
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + Math.PI * 0.8);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    return true; // 描画成功
  }

  // エラー描画
  const errorMessageList = {
    "paidVideo": "有料動画\n有料動画を再生するには手続きが必要です",
    "tooManyTabs": "エラー\n複数のタブやウィンドウで動画を視聴しています\n他のタブやウィンドウを閉じてから\nページを再読み込みしてください",
    "unknown": "不明なエラーが発生しました",
  };
  function drawError(ctx, reason_code) {
    if (!reason_code) reason_code = "unknown";
    const errorMessage = `${errorMessageList[reason_code] || reason_code}`;
    const fontSize = 50;
    ctx.font = `${fontSize}px ${fontFamily}`;
    const lines = errorMessage.split('\n');
    // 各行の幅を計測し、最大幅を取得
    const lineWidths = lines.map(line => ctx.measureText(line).width);
    const textWidth = Math.max(...lineWidths);
    const lineHeight = fontSize * 1.2;
    const textHeight = lineHeight * lines.length;
    const padding = 60;
    const radius = 24;
    const x = (ctx.canvas.width - textWidth) / 2 - padding;
    const y = (ctx.canvas.height - textHeight) / 2 - padding;
    const bgWidth = textWidth + padding * 2;
    const bgHeight = textHeight + padding * 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + bgWidth - radius, y);
    ctx.arcTo(x + bgWidth, y, x + bgWidth, y + radius, radius);
    ctx.lineTo(x + bgWidth, y + bgHeight - radius);
    ctx.arcTo(x + bgWidth, y + bgHeight, x + bgWidth - radius, y + bgHeight, radius);
    ctx.lineTo(x + radius, y + bgHeight);
    ctx.arcTo(x, y + bgHeight, x, y + bgHeight - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220,235,255,0.85)'; // 優しい青系
    ctx.fill();
    ctx.restore();

    // 各行を中央に描画
    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = ctx.canvas.width / 2;
    let startY = (ctx.canvas.height - textHeight) / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], centerX, startY + i * lineHeight);
    }
    return true; // 描画成功
  }

  drawPip = function (_ctx) {
    // const now = performance.now();
    // {
    //   // FPS調整
    //   const targetFPS = 60.0; // ターゲットFPS
    //   const targetFrameTime = 1000.0 / targetFPS; // ターゲットフレーム時間（ミリ秒）
    //   const lastDrawTime = context.pip.draw.lastDrawTime || 0;
    //   // 前回の描画からの経過時間を計算
    //   const diffTime = now - lastDrawTime;
    //   // ターゲットフレーム時間よりも長い場合は描画をスキップ
    //   if (diffTime < targetFrameTime) return;
    // }
    // context.pip.draw.lastDrawTime = now;
    // context.pip.draw.frameCount++;
    // // FPS値の更新
    // if (now - context.pip.draw.fpsLastUpdateTime >= 1000) {
    //   const diffTime = now - context.pip.draw.fpsLastUpdateTime;
    //   const frameCount = context.pip.draw.frameCount;
    //   const diffFrameCount = frameCount - context.pip.draw.fpsLastUpdateFrameCount;
    //   // FPSを計算
    //   context.pip.draw.fps = Math.round(diffFrameCount / (diffTime / 1000));
    //   context.pip.draw.fpsLastUpdateTime = now;
    //   context.pip.draw.fpsLastUpdateFrameCount = context.pip.draw.frameCount;
    //   // デバッグモードであればコンソールに出力
    //   if (debugMode) {
    //     console.debug(`PIP FPS: ${context.pip.draw.fps}`);
    //   }
    // }

    const ctx = _ctx;
    if (!ctx) {
      console.error("No context provided for PIP drawing.");
      return;
    }
    const status = context.status;

    // 描画リセット
    clear(ctx);

    // コメント以外のメインコンテンツの描画結果
    // 描画に失敗した場合はロード中の円を描画
    let result = true;

    // ロード中の場合、ロード中の円を描画（描画は最後に行う）
    if (status.type === "loading") {
       result = false;
    }

    // videoの場合、動画を描画
    if (status.type === "video") {
      result &= drawVideo(ctx);
    }

    // supporterの場合、ニコニ貢献を描画
    if (status.type === "supporter") {
      result &= drawSupporter(ctx);
    }

    // adの場合、広告を描画
    if (status.type?.startsWith("ad-")) {
      result &= drawAd(ctx);
    }

    // nextVideoの場合、次の動画紹介を描画
    if (status.type === "nextVideo") {
      result &= drawNextVideo(ctx);
    }

    // コメントを描画
    if (status.type === "video" || status.type === "supporter" || status.type === "error") {
      drawComments(ctx);
    }

    // errorの場合、エラーを描画
    if (status.type === "error") {
      result &= drawError(ctx, status.details);
    }

    // 描画結果が無効な場合はロード中の円を描画
    if (!result) {
      drawLoadingCircle(ctx);
    }

    // // 再生時間の現在値 === 動画の長さの場合かつ再生中の場合は、ロード中の円を描画
    // const currentTime = getContentCurrentTime();
    // const duration = getContentDuration();
    // if (currentTime === duration && status.playing && status.type !== "nextVideo") {
    //   result = false; // 描画失敗
    //   // 緑の円を描画
    //   drawLoadingCircle(ctx, '#00ff00'); // 緑色で描画
    // }

    // // プレイヤーのロード円を検出
    // if (result) {
    //   const playerElement = context.elements.player.player;
    //   const loadingSelector = 'div[data-part="root"][data-scope="presence"]';
    //   const loadingElement = playerElement && playerElement.querySelector(loadingSelector);
    //   // [data-state="open"]を検出
    //   const isLoading = loadingElement && loadingElement.getAttribute('data-state') === 'open';
    //   result = !isLoading; // ロード中の円が表示されている場合は描画失敗とする
    //   // 赤い円を描画
    //   if (!result) {
    //     drawLoadingCircle(ctx, '#ff0000'); // 赤色で描画
    //   }
    // }

    // デバッグ情報を描画
    //if (debugMode) drawDebug(ctx);
  }
}
