"use strict";

// 時間に関するユーティリティ関数

// --- functions ---------------------------------------------------------------
let getPlayerCurrentTime = null;    // プレイヤーの現在の再生時間を取得する関数
let getPlayerDuration = null;       // プレイヤーの総再生時間を取得する関数
let getSeekBarCurrentTime = null;   // シークバーの現在の再生時間を取得する関数
let getSeekBarDuration = null;      // シークバーの総再生時間を取得する関数
let getContentCurrentTime = null;   // コンテンツの現在の再生時間を取得する関数
let getContentDuration = null;      // コンテンツの総再生時間を取得する関数
let updateTimeCaches = null;        // 各種時間のキャッシュを更新する関数
// -----------------------------------------------------------------------------

{
  // 時間テキスト（:区切り）を秒数に変換する関数
  function parseTimeTextToSeconds(timeText) {
    if (typeof timeText !== 'string') return -1; // 無効値
    const parts = timeText.split(':');
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

  // 現在の再生時間要素を取得する関数
  function getCurrentTimeElement() {
    const status = context.status;
    if (!status || !status.type) return;
    const currentTimeElement = status.type?.startsWith("ad-") ?
      document.querySelector('div[aria-label="videoAd - currentTime"]') :
      document.querySelector('div[aria-label="video - currentTime"]');
    if (!currentTimeElement) return;
    return currentTimeElement;
  }

  // video要素の再生時間を取得する関数
  function getActiveVideoElement() {
    const status = context.status;
    if (!status || !status.type) return null;
    if (status.type === "video") {
      // 動画再生中のvideo要素を取得
      return context.elements.player.player;
    }
    if (status.type?.startsWith("ad-")) {
      // 広告再生中のvideo要素を取得
      const index = status.index;
      if (index < 0 || index >= context.elements.ad.adVideo.length) return null;
      return context.elements.ad.adVideo[index];
    }
    return null; // 動画再生中でない場合はnullを返す
  }

  // シークバーの総再生時間を取得する関数
  let getSeekBarCurrentTime_cache = null;
  function getSeekBarCurrentTime_cacheUpdate_helper() {
    const status = context.status;
    if (!status || !status.type) return -1;
    // 現在の再生時間要素を取得
    const currentTimeElement = getCurrentTimeElement();
    if (!currentTimeElement) return -1;
    // aria-valuenow 属性から現在の再生時間を取得（テキスト）
    const currentTimeText = currentTimeElement.getAttribute('aria-valuenow');
    if (!currentTimeText) return -1;
    const currentTime = parseFloat(currentTimeText);
    if (isNaN(currentTime)) return -1;
    if (currentTime < 0) return -1;
    return Math.floor(currentTime); // 整数に変換
  }
  function getSeekBarCurrentTime_cacheUpdate() {
    const value = getSeekBarCurrentTime_cacheUpdate_helper();
    getSeekBarCurrentTime_cache = value;
  }
  getSeekBarCurrentTime = function() {
    return getSeekBarCurrentTime_cache;
  }

  // シークバーの総再生時間を取得する関数
  let getSeekBarDuration_cache = null;
  function getSeekBarDuration_cacheUpdate_helper() {
    const status = context.status;
    if (!status || !status.type) return -1;
    // 現在の再生時間要素を取得
    const currentTimeElement = getCurrentTimeElement();
    if (!currentTimeElement) return -1;
    // aria-valuemax 属性から総再生時間を取得（テキスト）
    const durationText = currentTimeElement.getAttribute('aria-valuemax');
    if (!durationText) return -1;
    const duration = parseFloat(durationText);
    if (isNaN(duration)) return -1;
    if (duration < 0) return -1;
    return Math.floor(duration); // 整数に変換
  }
  function getSeekBarDuration_cacheUpdate() {
    const value = getSeekBarDuration_cacheUpdate_helper();
    getSeekBarDuration_cache = value;
  }
  getSeekBarDuration = function() {
    return getSeekBarDuration_cache;
  }

  // プレイヤーの現在の再生時間を取得する関数
  let getPlayerCurrentTime_cache = null;
  function getPlayerCurrentTime_cacheUpdate_helper() {
    const currentTimeText = context.time.current;
    if (!currentTimeText) return -1;
    return parseTimeTextToSeconds(currentTimeText);
  }
  function getPlayerCurrentTime_cacheUpdate() {
    const value = getPlayerCurrentTime_cacheUpdate_helper();
    getPlayerCurrentTime_cache = value;
  }
  getPlayerCurrentTime = function() {
    return getPlayerCurrentTime_cache;
  }

  // プレイヤーの総再生時間を取得する関数
  let getPlayerDuration_cache = null;
  function getPlayerDuration_cacheUpdate_helper() {
    const durationText = context.time.duration;
    if (!durationText) return -1;
    return parseTimeTextToSeconds(durationText);
  }
  function getPlayerDuration_cacheUpdate() {
    const value = getPlayerDuration_cacheUpdate_helper();
    getPlayerDuration_cache = value;
  }
  getPlayerDuration = function() {
    return getPlayerDuration_cache;
  }

  // コンテンツの現在の再生時間を取得する関数
  let getContentCurrentTime_cache = null;
  function getContentCurrentTime_cacheUpdate_helper() {
    // ステータスごとに異なる要素を取得
    const status = context.status;
    if (!status || !status.type) return -1;
    if (status.type === "loading") {
      return 0;
    }
    if (status.type === "video") {
      return getPlayerCurrentTime();
    }
    if (status.type === "supporter") {
      return getPlayerCurrentTime() - getPlayerDuration();
    }
    if (status.type?.startsWith("ad-")) {
      const videoElement = getActiveVideoElement();
      if (!videoElement) return -1;
      const currentTime = videoElement.currentTime;
      if (isNaN(currentTime)) return -1;
      return Math.floor(currentTime);
    }
    if (status.type === "nextVideo") {
      return 0;
    }
    if (status.type === "error") {
      return getPlayerCurrentTime();
    }
    return -1;
  }
  function getContentCurrentTime_cacheUpdate() {
    const value = getContentCurrentTime_cacheUpdate_helper();
    getContentCurrentTime_cache = value;
  }
  getContentCurrentTime = function() {
    return getContentCurrentTime_cache;
  }

  // コンテンツの総再生時間を取得する関数
  let getContentDuration_cache = null;
  function getContentDuration_cacheUpdate_helper() {
    // ステータスごとに異なる要素を取得
    const status = context.status;
    if (!status || !status.type) return -1;
    if (status.type === "loading") {
      return 0;
    }
    if (status.type === "video") {
      return getPlayerDuration();
    }
    if (status.type === "supporter") {
      return getSeekBarDuration() - getPlayerDuration();
    }
    if (status.type?.startsWith("ad-")) {
      const videoElement = getActiveVideoElement();
      if (!videoElement) return -1;
      const duration = videoElement.duration;
      if (isNaN(duration)) return -1;
      return Math.floor(duration);
    }
    if (status.type === "nextVideo") {
      return 0;
    }
    if (status.type === "error") {
      return getPlayerDuration();
    }
    return -1;
  }
  function getContentDuration_cacheUpdate() {
    const value = getContentDuration_cacheUpdate_helper();
    getContentDuration_cache = value;
  }
  getContentDuration = function() {
    return getContentDuration_cache;
  }

  // キャッシュの更新
  updateTimeCaches = function() {
    getSeekBarCurrentTime_cacheUpdate();
    getSeekBarDuration_cacheUpdate();
    getPlayerCurrentTime_cacheUpdate();
    getPlayerDuration_cacheUpdate();
    getContentCurrentTime_cacheUpdate(); // playerCurrentとplayerDurationに依存する
    getContentDuration_cacheUpdate();    // playerDurationとplayerDurationに依存する
  }
}
