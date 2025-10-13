"use strict";

// MediaSessionの処理
// MediaSession APIがサポートされていない場合は何もしない
if ("mediaSession" in navigator) {
  // MediaSessionのアクションハンドラを設定
  navigator.mediaSession.setActionHandler('play', function() {
    playerController_play();
  });
  navigator.mediaSession.setActionHandler('pause', function() {
    playerController_pause();
  });
  navigator.mediaSession.setActionHandler('seekto', function(details) {
    const seekTime = details.seekTime;
    playerController_seek(seekTime);
  });
  navigator.mediaSession.setActionHandler('seekbackward', function() {
    playerController_seekBackward();
  });
  navigator.mediaSession.setActionHandler('seekforward', function() {
    playerController_seekForward();
  });
  navigator.mediaSession.setActionHandler('previoustrack', function() {
    playerController_previousTrack();
  });
  navigator.mediaSession.setActionHandler('nexttrack', function() {
    playerController_nextTrack();
  });
  navigator.mediaSession.setActionHandler('stop', function() {
    playerController_stop();
  });
  // 自動PiP
  try {
    navigator.mediaSession.setActionHandler("enterpictureinpicture", function() {
      if (!context.pip || !context.pip.videoElement) {
        console.debug("Auto PiP: No video element for PiP.");
        return;
      }
      console.debug("Auto PiP: Entering Picture-in-Picture mode.");
      context.pip.videoElement.requestPictureInPicture().catch((error) => {
        console.debug("Auto PiP: Failed to enter Picture-in-Picture mode.", error);
      }).then(() => {
        console.debug("Auto PiP: Successfully entered Picture-in-Picture mode.");
      });
    });
    console.debug("Auto PiP: setActionHandler for enterpictureinpicture succeeded.");
  } catch (error) {
    console.debug("Auto PiP: setActionHandler for enterpictureinpicture failed.", error);
  }

  // 動画情報の反映
  addEventListener(window, "動画情報更新時にmediaSession情報を更新",
                   videoInfoChangedEventName, function() {
    const info = context.info;
    if (!info || !info.ready) {
      // 動画情報がない場合はクリア
      navigator.mediaSession.metadata = null;
      console.debug("MediaSession metadata cleared.");
      return;
    }
    // 動画情報がある場合は更新
    navigator.mediaSession.metadata = new MediaMetadata({
      title: info.title,
      artist: info.author,
      album: "Niconico",
      artwork: [
        {
          src: info.thumbnail.url,
          sizes: `${info.thumbnail.width}x${info.thumbnail.height}`,
          type: info.thumbnail.type
        }
      ]
    });
    console.debug("MediaSession metadata updated.");
  });

  // positionStateを更新する関数
  function updatePositionState() {
    // ステータス取得
    const status = context.status;
    // ステータスがnextVideoの場合は生放送扱い
    if (status.type === "nextVideo") {
      const positionState = {
        duration: Infinity,
        playbackRate: 1.0,
        position: 0,
      };
      navigator.mediaSession.setPositionState(positionState);
      // 常に再生中として扱う
      navigator.mediaSession.playbackState = "playing";
      //console.debug("MediaSession positionState updated for nextVideo:", positionState);
      return;
    }
    // playbackStateを更新
    navigator.mediaSession.playbackState = status.playing ? "playing" : "paused";
    // positionStateを取得
    const duration = getSeekBarDuration();
    const playbackRate = status.type === "video" ? context.elements.menu.video.playbackRate : 1.0;
    const position = getSeekBarCurrentTime();
    // 値の検証
    if (duration < 0 || isNaN(duration)) {
      console.debug("Invalid duration:", duration);
      return;
    }
    if (playbackRate < 0 || isNaN(playbackRate)) {
      console.debug("Invalid playbackRate:", playbackRate);
      return;
    }
    if (position < 0 || isNaN(position) || position > duration) {
      console.debug("Invalid position:", position);
      return;
    }
    // positionStateを更新
    const positionState = {
      duration: duration,
      playbackRate: playbackRate,
      position: position,
    };
    navigator.mediaSession.setPositionState(positionState);
    // console.debug("MediaSession positionState updated:", positionState,
    //               "MediaSession playbackState:", navigator.mediaSession.playbackState,
    //               "Status:", status);
  }
  // ステータスが変化したときにpositionStateを更新
  addEventListener(window, "ステータス更新時にpositionStateを更新",
                   statusChangedEventName, function() {
    updatePositionState();
  });
  // 動画時間が変化したときにpositionStateを更新
  addEventListener(window, "動画時間更新時にpositionStateを更新",
                   videoTimeChangedEventName, function() {
    updatePositionState();
  });
}
