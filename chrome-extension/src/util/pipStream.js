"use strict";

// PIP動画のストリームを管理する処理

// --- functions ---------------------------------------------------------------
let startStream = null;
let stopStream = null;
let requestStreamPause = null;
let requestStreamResume = null;
let checkAndRecoverCanvas = null;
// -----------------------------------------------------------------------------

{
  let currentStream = null;     // 現在のストリーム
  let drawFunction = null;      // 描画関数（描画再開用）
  let locked = false;           // ストリームがロックされているかどうか
  let requestPauseFlag = false; // ストリームの一時停止要求フラグ
  let isPaused = false;         // ストリームが一時停止中かどうか

  // ストリームの一時停止要求
  requestStreamPause = function () {
    // デバッグモードでPIP動画の描画を常に行う場合は処理しない
    if (debugMode && debug_pipAlwaysDraw) {
      console.debug("Debug mode: Always drawing, no pause requested.");
      return;
    }
    // フラグをセット
    requestPauseFlag = true;
  }

  // ストリームの再開要求
  requestStreamResume = function () {
    // デバッグモードでPIP動画の描画を常に行う場合は処理しない
    if (debugMode && debug_pipAlwaysDraw) {
      console.debug("Debug mode: Always drawing, no resume requested.");
      return;
    }
    // 一時停止中でない場合は何もしない
    if (!isPaused) {
      console.debug("Stream is not paused, no action taken.");
      return;
    }
    // 描画関数が存在しない場合はエラー
    if (!drawFunction) {
      console.error("No draw function available to resume.");
      return;
    }
    console.debug("Resuming stream...");
    // フラグをリセット
    requestPauseFlag = false;
    isPaused = false;
    // 描画関数を呼び出して再開
    drawFunction();
    drawFunction = null; // 描画関数をクリア
  }

  // ストリームの一時停止関数
  function pauseStream(draw) {
    // デバッグモードでPIP動画の描画を常に行う場合は処理しない
    if (debugMode && debug_pipAlwaysDraw) {
      console.debug("Debug mode: Always drawing, no pause requested.");
      return;
    }
    // フラグをセット
    isPaused = true;
    drawFunction = draw; // 現在の描画関数を保存
  }

  // Canvasが汚染されているかチェック
  function isCanvasTainted(canvas) {
    try {
      const ctx = getContext(canvas);
      ctx.getImageData(0, 0, 1, 1);
      // or: canvas.toDataURL();
      return false;
    } catch (e) {
      if (e instanceof DOMException && e.name === "SecurityError") {
        return true;
      }
      throw e; // 予期しないエラーは投げ直し
    }
  }

  // Canvasのステータスチェック
  checkAndRecoverCanvas = function () {
    const canvas = currentStream?.canvas;
    if (!canvas) return true;
    console.debug("Checking canvas status...");
    if (isCanvasTainted(canvas)) {
      console.warn("Canvas is tainted. Attempting to recover...");
      stopStream();
      startStream();
      return false;
    }
    return true;
  }

  // 描画関数の作成
  function createAnimationFrameCallback(_stream, _canvas, _ctx) {
    // 引数のチェック
    {
      const stream = _stream;
      if (!stream || !(stream instanceof MediaStream)) {
        console.error("Invalid stream.");
        return;
      }
      const canvas = _canvas;
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.error("Stream canvas is not available.");
        return;
      }
      const ctx = _ctx;
      if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) {
        console.error("Canvas context is not available.");
        return;
      }
    }
    // 描画関数
    const draw = function () {
      // デバッグ用
      if (debugMode && debug_viewTime) {
        const now = performance.now();
        context.debug.pip.frameCount++;
        // FPSの更新
        if (now - context.debug.pip.fpsLastUpdateTime >= 1000) {
          const diffTime = now - context.debug.pip.fpsLastUpdateTime;
          const frameCount = context.debug.pip.frameCount;
          const frameCountDiff = frameCount - context.debug.pip.fpsLastUpdateFrameCount;
          context.debug.pip.fps = (frameCountDiff / (diffTime / 1000));
          context.debug.pip.fpsLastUpdateTime = now;
          context.debug.pip.fpsLastUpdateFrameCount = frameCount;
        }
        const fastUpdateInfoContainer1 = document.getElementById(`${prefixId}-fast-update-info-span-1`);
        if (fastUpdateInfoContainer1) {
          fastUpdateInfoContainer1.textContent = `Performance Time: ${now.toFixed(2)} ms\n` +
                                                 `PIP Animation Frame: ${context.debug.pip.frameCount}\n` +
                                                 `PIP Animation FPS: ${context.debug.pip.fps.toFixed(2)}\n` +
                                                 `SeekBar Ratio: ${(getSeekBarCurrentRatioValue() * 100).toFixed(2)} %`
        }
        const fastUpdateInfoContainer2 = document.getElementById(`${prefixId}-fast-update-info-span-2`);
        if (fastUpdateInfoContainer2) {
          // statusがvideoのときだけ、videoの再生位置を表示
          if (context.status.type === "video") {
            const videoElement = context.elements.menu.video;
            if (videoElement) {
              const currentTime = videoElement.currentTime;
              const duration = videoElement.duration;
              const playbackQuality = videoElement.getVideoPlaybackQuality();
              // FPS更新（1秒が経過したら）
              const playbackQualityCreationTime = playbackQuality.creationTime;
              if (playbackQualityCreationTime - context.debug.video.fpsLastUpdateTime >= 1000) {
                const diffTime = playbackQualityCreationTime - context.debug.video.fpsLastUpdateTime;
                const frameCount = playbackQuality.totalVideoFrames;
                const frameCountDiff = frameCount - context.debug.video.fpsLastUpdateFrameCount;
                context.debug.video.fps = (frameCountDiff / (diffTime / 1000));
                context.debug.video.fpsLastUpdateTime = playbackQualityCreationTime;
                context.debug.video.fpsLastUpdateFrameCount = frameCount;
              }
              // HTML描画
              fastUpdateInfoContainer2.textContent = `Video Current Time: ${currentTime.toFixed(2)} s\n` +
                                                     `Video Duration: ${duration.toFixed(2)} s\n` +
                                                     `Video Playback Rate: ${videoElement.playbackRate.toFixed(2)}x\n` +
                                                     `Video Frame: ${playbackQuality.totalVideoFrames}\n` +
                                                     `Video FPS: ${context.debug.video.fps.toFixed(2)}`
            }
          }
        }
      }

      // pause中は何もしない
      if (isPaused) {
        console.debug("Stream is paused.");
        return;
      }
      // ストリームが変更された場合はアニメーションフレームを停止
      if (_stream !== currentStream) {
        console.debug("Current stream has changed, stopping animation frame.");
        return;
      }
      if (locked) {
        // ロック中は描画しない
        console.warn("Stream is locked, skipping frame.");
      } else {
        // 描画開始時にロック
        locked = true;
        // 描画処理
        try {
          const ctx = getContext(currentStream.canvas);
          if (ctx !== _ctx) {
            console.error("Canvas context has changed, stopping animation frame.");
          }
          if (currentStream) drawPip(ctx); // PIP動画の描画処理を呼び出す
        } catch (e) {
          console.error("Error occurred while drawing PIP:", e);
        }
        // 描画終了後にロック解除
        locked = false;
      }
      // 一時停止要求があれば一時停止して終了
      if (requestPauseFlag) {
        pauseStream(draw);
        console.debug("Stream paused by request.");
      }
      requestAnimationFrame(draw);
    }

    return draw;
  }

  function getContext(canvas) {
    return canvas.getContext('2d');
  }

  // 新しいストリームとCanvasを作成する関数
  function createStreamWithCanvasAndContext() {
    const canvas = document.createElement('canvas');
    canvas.width = videoPipCanvasWidth;
    canvas.height = videoPipCanvasHeight;
    const ctx = getContext(canvas);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream();
    stream.canvas = canvas; // ストリームにcanvasを追加
    return { stream, canvas, ctx };
  }

  // ストリームを開始する関数
  startStream = function (isDummy = false) {
    // 既存のストリームを停止
    stopStream();
    // 新しいストリームを作成
    const { stream, canvas, ctx } = createStreamWithCanvasAndContext();
    // ストリームを設定
    currentStream = stream;
    if (isDummy) {
      console.debug("dummy stream.");
    } else {
      // アニメーションフレームのコールバックを作成
      const animationFrameCallback = createAnimationFrameCallback(stream, canvas, ctx);
      // PIPが無効な場合はpauseを要求
      const pipStatus = context.pip.status;
      // PIP動画が有効であればアニメーションフレームを開始
      // または、デバッグモードでPIP動画の描画を常に行う場合はアニメーションフレームを開始
      if (pipStatus === "enabled" || (debugMode && debug_pipAlwaysDraw)) {
        console.debug("PIP is enabled, starting animation frame.");
        animationFrameCallback();
      } else {
        console.debug("PIP is not enabled, pausing stream.", "PIP status:", pipStatus);
        pauseStream(animationFrameCallback);
      }
    }
    // PIP動画要素にストリームを設定
    context.pip.videoElement.srcObject = stream;
    console.debug("PIP video stream started.");
    // ストリーム変更イベントを発火
    window.dispatchEvent(new CustomEvent(streamChangedEventName, {
      detail: { stream: currentStream }
    }));
  }

  // ストリームを停止する関数
  stopStream = function () {
    if (currentStream) {
      // ストリームを停止
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
      // PIP動画要素のsrcObjectをnullに設定
      context.pip.videoElement.srcObject = null;
      console.debug("PIP video stream stopped.");
      // ストリーム変更イベントを発火
      window.dispatchEvent(new CustomEvent(streamChangedEventName, {
        detail: { stream: null }
      }));
    } else {
      console.debug("No PIP video stream to stop.");
    }
  }
}
