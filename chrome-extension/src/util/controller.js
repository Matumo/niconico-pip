"use strict";

// プレイヤーを操作する処理

// --- functions ---------------------------------------------------------------
let playerController_play = null;
let playerController_pause = null;
let playerController_stop = null;
let playerController_seek = null;
let playerController_seekBackward = null;
let playerController_seekForward = null;
let playerController_previousTrack = null;
let playerController_nextTrack = null;
// -----------------------------------------------------------------------------

{
  // playボタンの状態判定
  function isPlay(playBtn) {
    // [aria-label="一時停止する"] or [aria-label="再生する"]
    const ariaLabel = playBtn.getAttribute("aria-label");
    if (!ariaLabel) {
      console.warn("Play button does not have aria-label attribute.");
      return null;
    }
    return ariaLabel === "一時停止する";
  }

  // 動画の再生
  playerController_play = function () {
    // ボタンの取得
    const playBtn = context.elements.controller.playBtn;
    if (!playBtn) {
      console.warn("Play button not found.");
      return;
    }
    // 現在の再生状態を確認
    const isPlaying = isPlay(playBtn);
    if (isPlaying === null) {
      console.warn("Play button state could not be determined.");
      return;
    }
    // 停止中なら再生ボタンをクリック
    if (!isPlaying) {
      playBtn.click();
      console.debug("Video playback started.");
    } else {
      console.debug("Video is already playing.");
    }
  };

  // 動画の一時停止
  playerController_pause = function () {
    const status = context.status;
    // ステータスがnextVideoの場合は0秒にシーク
    if (status.type === 'nextVideo') {
      playerController_seek(0);
      console.debug("Next video status detected, seeking to start.");
    }
    // ボタンの取得
    const playBtn = context.elements.controller.playBtn;
    if (!playBtn) {
      console.warn("Play button not found.");
      return;
    }
    // 現在の再生状態を確認
    const isPlaying = isPlay(playBtn);
    if (isPlaying === null) {
      console.warn("Play button state could not be determined.");
      return;
    }
    // 再生中なら一時停止ボタンをクリック
    if (isPlaying) {
      playBtn.click();
      console.debug("Video playback paused.");
    } else {
      console.debug("Video is already paused.");
    }
  };

  // 動画の停止
  playerController_stop = function () {
    playerController_pause();
    playerController_seek(0);
    console.debug("Video playback stopped and seeked to start.");
  };

  // シークバーのクリックイベントを発火する関数
  function seekTo(_percent) {
    // パーセンテージを0〜1の範囲に制限
    const percent = Math.min(Math.max(_percent, 0), 1);
    const currentTimeElement = document.querySelector('div[aria-label="video - currentTime"]');
    if (!currentTimeElement) {
      console.debug("Current time element not found.");
      return;
    }
    // シークバー全体（3階層上が典型的）
    let seekbarRoot = currentTimeElement;
    if (!seekbarRoot.parentElement) {
      console.debug("Seekbar root not found.");
      return;
    }
    for (let i = 0; i < 3; i++) {
      if (seekbarRoot.parentElement) seekbarRoot = seekbarRoot.parentElement;
    }
    // シークバーのヒットエリアを取得
    const hitArea = seekbarRoot.querySelector('.cursor_pointer');
    if (!hitArea) {
      console.debug("Hit area not found.");
      return;
    }
    // シークバーの位置を計算
    const rect = hitArea.getBoundingClientRect();
    const x = rect.left + rect.width * percent;
    const y = rect.top + rect.height / 2;
    // ヒットエリアの指定位置にクリックイベントを発火
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window
    });
    hitArea.dispatchEvent(evt);
  }

  // 再生時間と総再生時間から再生割合を計算する関数
  function getPercentFromSeconds(seconds, duration) {
    if (seconds < 0 || duration <= 0) return -1; // 無効値
    if (seconds > duration) return -1; // 無効値
    return seconds / duration;
  }

  // 総再生時間（:区切り）を秒数に変換する関数
  function parseDurationToSeconds(duration) {
    if (typeof duration !== 'string') return -1; // 無効値
    const parts = duration.split(':');
    if (parts.length !== 2 && parts.length !== 3) return -1; // 無効値
    let seconds = 0;
    if (parts.length === 3) {
      // HH:MM:SS形式
      seconds += parseInt(parts[0], 10) * 3600; // 時間を秒に変換
      seconds += parseInt(parts[1], 10) * 60;   // 分を秒に変換
      seconds += parseInt(parts[2], 10);        // 秒
    }
    if (parts.length === 2) {
      // MM:SS形式
      seconds += parseInt(parts[0], 10) * 60;   // 分を秒に変換
      seconds += parseInt(parts[1], 10);        // 秒
    }
    return seconds;
  }

  // 動画のシーク
  playerController_seek = function (_seconds) {
    //const duration = parseDurationToSeconds(context.time.duration);
    const currentTimeElement = document.querySelector('div[aria-label="video - currentTime"]');
    if (!currentTimeElement) {
      console.debug("Current time element not found.");
      return;
    }
    // aria-valuemax 属性から総再生時間を取得（数値）
    const duration_text = currentTimeElement.getAttribute('aria-valuemax');
    if (!duration_text) {
      console.debug("Duration text not found in current time element.");
      return;
    }
    // 総再生時間を数字に変換
    const duration = parseFloat(duration_text);
    if (isNaN(duration)) {
      console.debug("Invalid duration format:", duration_text);
      return;
    }
    if (duration < 0) {
      console.debug("Invalid duration format:", context.time.duration);
      return;
    }
    if (isNaN(_seconds)) {
      console.debug("Invalid seconds input:", _seconds);
      return;
    }
    const seconds = Math.max(0, Math.min(_seconds, duration)); // 範囲を0〜durationに制限
    // 秒数からパーセンテージを計算
    const percent = getPercentFromSeconds(seconds, duration);
    if (isNaN(percent)) {
      console.debug("Invalid percent calculated from seconds:", seconds, "Duration:", duration);
      return;
    }
    // シーク
    console.debug(`Seeking to ${seconds} seconds (${percent * 100}%)...`);
    seekTo(percent);
  }

  // シークバック
  playerController_seekBackward = function () {
    const seekBackwardBtn = context.elements.controller.seekBackwardBtn;
    if (!seekBackwardBtn) {
      console.warn("Seek backward button not found.");
      return;
    }
    // シークバックボタンをクリック
    seekBackwardBtn.click();
    console.debug("Video seeked backward.");
  }

  // シークフォワード
  playerController_seekForward = function () {
    const seekForwardBtn = context.elements.controller.seekForwardBtn;
    if (!seekForwardBtn) {
      console.warn("Seek forward button not found.");
      return;
    }
    // シークフォワードボタンをクリック
    seekForwardBtn.click();
    console.debug("Video seeked forward.");
  }

  // 前のトラックへ
  playerController_previousTrack = function () {
    const status = context.status;

    // // videoかつ2秒未満かつ前のページが動画再生ページであればページ遷移
    // if (status.type === 'video') {
    //   const time = getPlayerCurrentTime();
    //   if (time < 2) {
    //     const previousUrl = document.referrer;
    //     console.debug("Referrer URL:", previousUrl);
    //     if (previousUrl) {
    //       const isWatchPage = nicoVideoPageUrlPatternRegExp.test(previousUrl);
    //       if (isWatchPage) {
    //         window.location.href = previousUrl;
    //         console.debug("Switched to previous track (video type, referrer is watch page).");
    //         return;
    //       } else {
    //         console.debug("Referrer is not a watch page, seeking to start.");
    //       }
    //     }
    //   } else {
    //     console.debug("Current time is greater than 2 seconds, seeking to start. time=", time);
    //   }
    // }

    // シークで対応
    playerController_seek(0);
    console.debug("Switched to previous track. (Seek to start)");
    // nextVideoの場合は再生ボタンをクリック
    if (status.type === 'nextVideo') {
      playerController_play();
      console.debug("Switched to previous track (nextVideo type, play button clicked).");
    }
  }

  // 次のトラックへ
  playerController_nextTrack = function () {
    const status = context.status;
    // nextVideoの場合は今すぐ再生ボタンをクリック
    if (status.type === 'nextVideo') {
      const playNowBtn = context.elements.nextVideo.nextVideoPlayNowBtn;
      if (playNowBtn) {
        playNowBtn.click();
        console.debug("Next track is already set to nextVideo, play now button clicked.");
      } else {
        console.debug("Next track is already set to nextVideo, play now button not found.");
      }
      return;
    }
    // 広告の場合は広告スキップ
    if (status.type?.startsWith('ad-')) {
      console.debug("Next track is an ad, skipping ad.");
      clickAdSkipButton();
      return;
    }
    // シークで対応
    const duration = getPlayerDuration() || 1000000000;
    playerController_seek(duration + 100);
    console.debug("Switched to next track. (Seek to end)");
  }
}
