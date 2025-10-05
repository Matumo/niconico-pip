"use strict";

// video要素の描画を行う処理の管理
{
  const videoPipElement = document.createElement('video');
  {
    // video要素の属性を設定
    videoPipElement.id = pipVideoElementId;
    videoPipElement.muted = true;
    videoPipElement.autoplay = true;
    videoPipElement.loop = true;
    videoPipElement.style.zIndex = '10';
    videoPipElement.hidden = true; // 初期状態では非表示
    // デバッグモードで常に描画
    if (debugMode && debug_pipViewOutside) {
      videoPipElement.hidden = false;
    }
    // ダミーの動画を設定
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = videoPipCanvasWidth;
    dummyCanvas.height = videoPipCanvasHeight;
    //const dummyCtx = dummyCanvas.getContext('2d');
    const dummyCtx = dummyCanvas.getContext('2d', { willReadFrequently: true });
    dummyCtx.fillStyle = 'black';
    dummyCtx.fillRect(0, 0, dummyCanvas.width, dummyCanvas.height);
    const dummyStream = dummyCanvas.captureStream(1);
    videoPipElement.srcObject = dummyStream;
  }

  // PIP動画要素のコンテキスト更新
  updatePipVideoElementContext(videoPipElement);

  // PIP動画を挿入するイベントリスナー
  addEventListener(window, "コンテンツ要素の変更時にPIP動画を挿入",
                   elementChangedEventName, function(event) {
    const details = event.detail;
    const category = details.category;
    const name = details.name;
    const element = details.element;
    if (category === "menu" && name === "contents" && element) {
      startStream();
      // デバッグモードでPIP動画をHTML要素として描画する場合はdebug.jsで対応
      if (debugMode && debug_pipViewOutside) return;
      // menuの子要素として挿入
      const menuElement = context.elements.menu.menu;
      if (!menuElement) {
        console.warn("Menu element does not exist.");
        return;
      }
      menuElement.appendChild(videoPipElement);
      console.debug("PIP video element inserted into menu.");
    }
  });

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
        //const ctx = canvas.getContext('2d');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const offsetY = (h - newH) / 2;
        ctx.drawImage(img, 0, offsetY, w, newH, 0, 0, w, newH);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  }

  // 動画情報の更新時にサムネ取得
  addEventListener(window, "動画情報更新時にサムネ取得", videoInfoChangedEventName, () => {
    const info = context.info;
    if (!info || !info.ready) {
      console.debug("No video info available for thumbnail.");
      return;
    }
    const thenumbnailUrl = info.thumbnail.url;
    if (!thenumbnailUrl) {
      console.debug("No thumbnail URL found in video info.");
      return;
    }
    // contextの情報と比較してURLが同じなら何もしない
    const currentThumbnailUrl = context.image.thumbnail.url;
    if (currentThumbnailUrl === thenumbnailUrl) {
      console.debug("Thumbnail URL is unchanged.");
      return;
    }
    // 画像の取得、変換、セット
    makePoster16by9(thenumbnailUrl).then(dataUrl => {
      // コンテキストにセット
      context.image.thumbnail.url = thenumbnailUrl;
      context.image.thumbnail.data = dataUrl;
      // poster属性にセット
      videoPipElement.setAttribute('poster', dataUrl);
      console.debug("Thumbnail set for PIP video element.");
    }).catch(e => {
      // コンテキストをクリア
      context.image.thumbnail.url = null;
      context.image.thumbnail.data = null;
      // poster属性に変換前のURLをセット
      videoPipElement.setAttribute('poster', thenumbnailUrl);
      console.error("Failed to set thumbnail for PIP video element:", e);
    });
  });

  // ステータス同期
  function syncStatus() {
    const status = context.status;
    if (!status) {
      console.debug("No status available for PIP video element.");
      return;
    }
    // 再生状態
    // nextVideoは常に再生中とする
    const isPlayingPlayer = status.type === "nextVideo" ? true : status.playing;
    const isPlayingPip = !videoPipElement.paused;
    if (isPlayingPlayer !== isPlayingPip) {
      if (isPlayingPlayer) {
        videoPipElement.play().catch(error => {
          console.debug("Failed to play PIP video element:", error);
        });
      } else {
        videoPipElement.pause();
      }
      console.debug("PIP video element playback state synced:", isPlayingPlayer);
    } else {
      console.debug("PIP video element playback state is already synced:", isPlayingPlayer);
    }
  }

  // ステータス変更時にステータスを同期するイベントリスナー
  addEventListener(window, "ステータス変更時にPIP動画のステータスを同期",
                   statusChangedEventName, () => {
    syncStatus();
  });
  // PIP動画がブラウザの描画対象であるかどうか切り替わったことを検知するObserver
  const pipVideoVisibilityObserver = new window.IntersectionObserver((entries) => {
    syncStatus();
  }, {
    root: null, // ビューポート
    threshold: 0.01 // 1%以上見えていれば可視とみなす
  });
  pipVideoVisibilityObserver.observe(videoPipElement);
  // Streamの更新時にステータスを同期するイベントリスナー
  addEventListener(window, "ストリーム更新時にPIP動画のステータスを同期", streamChangedEventName, () => {
    syncStatus();
  });
  // 初期化時にステータス同期
  syncStatus();
}
