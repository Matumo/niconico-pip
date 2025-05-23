// MediaSessionの管理

// --- function ----------------------------------------------------------------
let updateVideoDataForMediaSession = null;
let setMediaSession = null;
// -----------------------------------------------------------------------------

{
  // 動画情報を取得する関数
  function getVideoData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        continue; // パース失敗はスキップ
      }
      // 配列の場合も考慮
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] === "VideoObject") return item;
        }
      } else if (data['@type'] === "VideoObject") {
        return data;
      }
    }
    return null;
  }

  // MediaSession用の動画情報を取得する関数
  function getVideoDataForMediaSession() {
    const data = getVideoData();
    if (data) {
      const title = data.name;
      const author = data.author &&
                     data.author.name ? data.author.name : "unknown";
      const thumbnail_url = (data.thumbnail &&
                            data.thumbnail.length && data.thumbnail[0].url)
                            ? data.thumbnail[0].url :
                              (Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : "");
      // サムネイルのサイズ情報も取得
      const thumbnail_width = data.thumbnail[0].width || 0;
      const thumbnail_height = data.thumbnail[0].height || 0;
      // サムネイルのtype（image/jpegなど）
      const thumbnail_type = data.thumbnail[0].type || "image/jpeg";
      // 返却値
      const result = {
        title: title,
        author: author,
        thumbnail: {
          url: thumbnail_url,
          width: thumbnail_width,
          height: thumbnail_height,
          type: thumbnail_type
        }
      };
      return result;
    } else {
      console.debug("VideoObject data not found.");
      return null;
    }
  }

  // MediaSessionの動画情報を更新する関数
  updateVideoDataForMediaSession = function() {
    if (!("mediaSession" in navigator)) {
      console.debug("MediaSession API is not supported.");
      return;
    }
    const data = getVideoDataForMediaSession();
    if (!data) {
      console.debug("VideoObject data not found.");
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: data.title,
      artist: data.author,
      album: "Niconico",
      artwork: [
        {
          src: data.thumbnail.url,
          sizes: `${data.thumbnail.width}x${data.thumbnail.height}`,
          type: data.thumbnail.type
        }
      ]
    });
    console.debug("MediaSession metadata updated.");
  }

  // positionStateに不備があるかどうかを判定する関数
  function isInvalidNumberForPositionState(value, { allowZero = false, max = Infinity } = {}) {
    return (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (!allowZero && value <= 0) ||
      value > max
    );
  }

  // positionStateを更新する関数
  function updatePositionState(_nicoVideoElement) {
    const nicoVideoElement = _nicoVideoElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    // MediaSession APIがサポートされていない場合は何もしない
    if (!("mediaSession" in navigator)) {
      console.debug("MediaSession API is not supported.");
      return;
    }
    // playbackStateを更新
    navigator.mediaSession.playbackState = nicoVideoElement.paused ? 'paused' : 'playing';
    // positionStateを取得
    const duration = nicoVideoElement.duration;
    const playbackRate = nicoVideoElement.playbackRate;
    const position = nicoVideoElement.currentTime;
    // 取得したpositionStateに不備があれば更新しない
    if (isInvalidNumberForPositionState(duration, { allowZero: true })) {
      console.debug("Video duration is invalid.", duration);
      return;
    }
    if (isInvalidNumberForPositionState(playbackRate, { allowZero: false })) {
      console.debug("Video playbackRate is invalid.", playbackRate);
      return;
    }
    if (isInvalidNumberForPositionState(position, { allowZero: true, max: duration })) {
      console.debug("Video position is invalid.", position);
      return;
    }
    // positionStateを更新
    const positionState = {
      duration: duration,
      playbackRate: playbackRate,
      position: position,
    }
    navigator.mediaSession.setPositionState(positionState);
  }

  // updatePositionStateのイベント登録
  let lastNicoVideoElement = null; // 二重登録回避
  let lastUpdatePositionStateFunc = null; // 二重登録回避
  function registerPositionStateUpdateEvent(_nicoVideoElement) {
    const nicoVideoElement = _nicoVideoElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (lastNicoVideoElement === nicoVideoElement) {
      console.debug("PositionState update event already registered.");
      return;
    }
    // コールバック関数を定義
    const updatePositionStateFunc = function() {
      updatePositionState(nicoVideoElement);
    }
    // 既存のイベントリスナーを削除
    if (lastUpdatePositionStateFunc) {
      try {
        nicoVideoElement.removeEventListener('timeupdate', lastUpdatePositionStateFunc);
        console.debug("Existing event listener removed.");
      } catch (e) {
        console.warn("Failed to remove existing event listener.", e);
      }
    }
    // 新しいイベントリスナーを登録
    lastNicoVideoElement = nicoVideoElement;
    lastUpdatePositionStateFunc = updatePositionStateFunc;
    nicoVideoElement.addEventListener('timeupdate', updatePositionStateFunc);
    console.debug("PositionState update event registered.");
  }

  // MediaSessionを設定
  setMediaSession = function(_nicoVideoElement, _videoPipElement) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    // MediaSession APIがサポートされていない場合は何もしない
    if (!("mediaSession" in navigator)) {
      console.debug("MediaSession API is not supported.");
      return;
    }
    // MediaSessionのアクションを設定
    navigator.mediaSession.setActionHandler('play', function() {
      controlVideoPlay(nicoVideoElement, videoPipElement);
    });
    navigator.mediaSession.setActionHandler('pause', function() {
      controlVideoPause(nicoVideoElement, videoPipElement);
    });
    navigator.mediaSession.setActionHandler('seekto', function(details) {
      const seekTime = details.seekTime;
      controlVideoSeek(nicoVideoElement, videoPipElement, seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', function(details) {
      const offset = - (details.seekOffset || seekBackwardDefaultOffset);
      controlVideoSeekOffset(nicoVideoElement, videoPipElement, offset);
    });
    navigator.mediaSession.setActionHandler('seekforward', function(details) {
      const offset = details.seekOffset || seekForwardDefaultOffset;
      controlVideoSeekOffset(nicoVideoElement, videoPipElement, offset);
    });
    // navigator.mediaSession.setActionHandler('previoustrack', function() {
    //   console.log("DEBUG: 009 Video previoustrack action.");
    // });
    // navigator.mediaSession.setActionHandler('nexttrack', function() {
    //   console.log("DEBUG: 010 Video nexttrack action.");
    // });
    navigator.mediaSession.setActionHandler('stop', function() {
      controlVideoPause(nicoVideoElement, videoPipElement);
      controlVideoSeek(nicoVideoElement, videoPipElement, 0);
    });
    // positionStateを更新するイベントを登録
    updatePositionState(nicoVideoElement);
    registerPositionStateUpdateEvent(nicoVideoElement);
  }
}
