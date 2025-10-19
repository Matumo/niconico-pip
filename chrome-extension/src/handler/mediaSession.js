"use strict";

// MediaSessionの処理
const exec_handler_mediaSession_js = async function() {
  // 動画再生ページであるかどうかを確認
  function checkWatchPage() {
    const isWatchPage = context.page.isWatchPage;
    if (!isWatchPage) {
      console.debug("MediaSession action ignored: not a watch page.");
    }
    return isWatchPage;
  }

  // MediaSession APIがサポートされていない場合は何もしない
  if ("mediaSession" in navigator) {
    // MediaSessionのアクションハンドラを設定
    navigator.mediaSession.setActionHandler('play', function() {
      if (!checkWatchPage()) return;
      playerController_play();
    });
    navigator.mediaSession.setActionHandler('pause', function() {
      if (!checkWatchPage()) return;
      playerController_pause();
    });
    navigator.mediaSession.setActionHandler('seekto', function(details) {
      if (!checkWatchPage()) return;
      const seekTime = details.seekTime;
      playerController_seek(seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', function() {
      if (!checkWatchPage()) return;
      playerController_seekBackward();
    });
    navigator.mediaSession.setActionHandler('seekforward', function() {
      if (!checkWatchPage()) return;
      playerController_seekForward();
    });
    navigator.mediaSession.setActionHandler('previoustrack', function() {
      if (!checkWatchPage()) return;
      playerController_previousTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', function() {
      if (!checkWatchPage()) return;
      playerController_nextTrack();
    });
    navigator.mediaSession.setActionHandler('stop', function() {
      if (!checkWatchPage()) return;
      playerController_stop();
    });

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
      }
      navigator.mediaSession.setPositionState(positionState);
      //console.debug("MediaSession positionState updated:", positionState);
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
}
