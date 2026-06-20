// 動画操作の管理

// --- function ----------------------------------------------------------------
let controlVideoPlay = null;
let controlVideoPause = null;
let controlVideoSeek = null;
let controlVideoSeekOffset = null;
let registerSyncPlaybackStateEvent = null;
// -----------------------------------------------------------------------------

{
  // MediaSessionの対応判定
  function isMediaSessionSupported() {
    return "mediaSession" in navigator;
  }

  // VideoPipElementのPIP有効判定
  function isVideoPipElementInPip(_videoPipElement) {
    const videoPipElement = _videoPipElement;
    const currentPiP = document.pictureInPictureElement;
    return currentPiP === videoPipElement;
  }

  // 動画ステータスを同期（nicoVideoElementに合わせる）
  function syncPlaybackState(_nicoVideoElement, _videoPipElement) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    // 動画の再生状態を取得
    const isPlaying = nicoVideoElement.paused === false;
    // PIPの状態を更新
    if (videoPipElement) {
      // videoPipElementがアクティブであるか確認
      const isVideoPipElementActive = isVideoPipElementInPip(videoPipElement);
      const isPipPlaying = videoPipElement.paused === false;
      if (!isVideoPipElementActive) {
        // videoPipElementがアクティブでない場合は一時停止
        if (isPipPlaying) {
          console.debug("VideoPipElement is not active, pausing.");
          videoPipElement.pause();
        }
      } else {
        // videoPipElementがアクティブな場合はステータスを同期
        if (isPlaying !== isPipPlaying) {
          console.debug("VideoPipElement is active, syncing playback state.",
                        "isPlaying:", isPlaying, "isPipPlaying:", isPipPlaying);
          if (isPlaying) videoPipElement.play();
          else videoPipElement.pause();
        }
      }
    }
    // MediaSessionのplaybackStateを更新
    if (isMediaSessionSupported()) {
      const isMediaSessionPlaying = navigator.mediaSession.playbackState === 'playing';
      if (isPlaying !== isMediaSessionPlaying) {
        console.debug("MediaSession playback state is different, updating.",
                      "isPlaying:", isPlaying, "isMediaSessionPlaying:", isMediaSessionPlaying);
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      }
    }
  }

  // シーク時間の正規化
  function normalizeSeekTime(_seekTime, _duration) {
    const seekTime = _seekTime;
    const duration = _duration;
    if (seekTime < 0) return 0;
    if (seekTime > duration) return duration;
    return seekTime;
  }

  // 動画の再生
  controlVideoPlay = function (_nicoVideoElement, _videoPipElement) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    // 動画を再生
    nicoVideoElement.play();
    // ステータスを同期
    syncPlaybackState(nicoVideoElement, videoPipElement);
  }

  // 動画の一時停止
  controlVideoPause = function (_nicoVideoElement, _videoPipElement) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    // 動画を一時停止
    nicoVideoElement.pause();
    // ステータスを同期
    syncPlaybackState(nicoVideoElement, videoPipElement);
  }

  // 動画のシーク
  controlVideoSeek = function (_nicoVideoElement, _videoPipElement, _seekTime) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    const seekTime = _seekTime;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    const duration = nicoVideoElement.duration;
    // シーク時間を正規化
    const normalizedSeekTime = normalizeSeekTime(seekTime, duration);
    // 動画をシーク
    if (nicoShortsPageUrlPatternRegExp.test(window.location.href)) {
      // WARNING: ショート動画はvideo要素やシークバー要素が複数同時に存在する
      // 必ずアクティブなショート動画配下から取得した要素を使う
      const shortsActiveEntry = document.querySelector(shortsActiveEntrySelector);
      const seeked = playerController_seek(normalizedSeekTime, shortsActiveEntry || document);
      if (!seeked) {
        // シークバーが畳まれている（rect=0）等でクリックできなかった場合のフォールバック。
        // 前進は直接代入でも正しく追従する。巻き戻しは早期終了の可能性が残るが、PiP中は開いているため稀。
        console.debug("Shorts seekbar click unavailable, fallback to direct currentTime.", normalizedSeekTime);
        nicoVideoElement.currentTime = normalizedSeekTime;
      }
    } else {
      playerController_seek(normalizedSeekTime);
    }
    // ステータスを同期
    syncPlaybackState(nicoVideoElement, videoPipElement);
  }

  // 動画のシーク（オフセット）
  controlVideoSeekOffset = function (_nicoVideoElement, _videoPipElement, _offset) {
    const nicoVideoElement = _nicoVideoElement;
    const offset = _offset;
    if (nicoVideoElement === null) {
      console.warn("Nico video element or video pip element is null.");
      return;
    }
    // シーク時間を計算
    const seekTime = nicoVideoElement.currentTime + offset;
    // シーク
    controlVideoSeek(nicoVideoElement, videoPipElement, seekTime);
  }

  // 動画のシーク
  // _root: シークバー要素を探す起点（watchはdocument、ショート動画はアクティブなショート動画要素）
  // シークバークリックを発火できたかどうかを返す
  const playerController_seek = function (_seconds, _root) {
    const root = _root || document;
    const currentTimeElement = root.querySelector('div[aria-label="video - currentTime"]');
    if (!currentTimeElement) {
      console.debug("Current time element not found.");
      return false;
    }
    // aria-valuemax 属性から総再生時間を取得（数値）
    const duration_text = currentTimeElement.getAttribute('aria-valuemax');
    if (!duration_text) {
      console.debug("Duration text not found in current time element.");
      return false;
    }
    // 総再生時間を数字に変換
    const duration = parseFloat(duration_text);
    if (isNaN(duration)) {
      console.debug("Invalid duration format:", duration_text);
      return false;
    }
    if (duration < 0) {
      console.debug("Invalid duration format:", duration_text);
      return false;
    }
    if (isNaN(_seconds)) {
      console.debug("Invalid seconds input:", _seconds);
      return false;
    }
    const seconds = Math.max(0, Math.min(_seconds, duration)); // 範囲を0〜durationに制限
    // 秒数からパーセンテージを計算
    const percent = getPercentFromSeconds(seconds, duration);
    if (isNaN(percent)) {
      console.debug("Invalid percent calculated from seconds:", seconds, "Duration:", duration);
      return false;
    }
    // シーク
    console.debug(`Seeking to ${seconds} seconds (${percent * 100}%)...`);
    return seekTo(percent, root);
  }

  // 再生時間と総再生時間から再生割合を計算する関数
  function getPercentFromSeconds(seconds, duration) {
    if (seconds < 0 || duration <= 0) return -1; // 無効値
    if (seconds > duration) return -1; // 無効値
    return seconds / duration;
  }

  // シークバーのクリックイベントを発火する関数
  // _root: シークバー要素を探す起点（watchはdocument、ショート動画はアクティブなショート動画要素）
  function seekTo(_percent, _root) {
    const root = _root || document;
    // パーセンテージを0〜1の範囲に制限
    const percent = Math.min(Math.max(_percent, 0), 1);
    const currentTimeElement = root.querySelector('div[aria-label="video - currentTime"]');
    if (!currentTimeElement) {
      console.debug("Current time element not found.");
      return false;
    }
    // シークバー全体（3階層上が典型的）
    let seekbarRoot = currentTimeElement;
    if (!seekbarRoot.parentElement) {
      console.debug("Seekbar root not found.");
      return false;
    }
    for (let i = 0; i < 3; i++) {
      if (seekbarRoot.parentElement) seekbarRoot = seekbarRoot.parentElement;
    }
    // シークバーのヒットエリアを取得
    const hitArea = seekbarRoot.querySelector('.cursor_pointer');
    if (!hitArea) {
      console.debug("Hit area not found.");
      return false;
    }
    // シークバーの位置を計算
    const rect = hitArea.getBoundingClientRect();
    // コントローラが畳まれているとrect=0でクリック座標を計算できない（座標0でクリックすると先頭へ飛ぶ）
    if (rect.width === 0) {
      console.debug("Seekbar hit area has zero width (controller closed).");
      return false;
    }
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
    return true;
  }

  // 動画ステータスの同期イベント登録
  let lastNicoVideoElement = null;
  let lastSyncPlaybackStateFunc = null;
  registerSyncPlaybackStateEvent = function (_nicoVideoElement, _videoPipElement) {
    const nicoVideoElement = _nicoVideoElement;
    const videoPipElement = _videoPipElement;
    if (nicoVideoElement === null) {
      console.warn("Nico video element is null.");
      return;
    }
    if (lastNicoVideoElement === nicoVideoElement) {
      console.debug("PlaybackState update event already registered.");
      return;
    }
    // コールバック関数を定義
    const syncPlaybackStateFunc = function() {
      syncPlaybackState(nicoVideoElement, videoPipElement);
    }
    // 既存のイベントリスナーを削除
    if (lastNicoVideoElement && lastSyncPlaybackStateFunc) {
      try {
        lastNicoVideoElement.removeEventListener('play', lastSyncPlaybackStateFunc);
        lastNicoVideoElement.removeEventListener('pause', lastSyncPlaybackStateFunc);
        console.debug("Existing event listener removed.");
      } catch (e) {
        console.warn("Failed to remove existing event listener.", e);
      }
    }
    // 新しいイベントリスナーを登録
    lastNicoVideoElement = nicoVideoElement;
    lastSyncPlaybackStateFunc = syncPlaybackStateFunc;
    nicoVideoElement.addEventListener('play', syncPlaybackStateFunc);
    nicoVideoElement.addEventListener('pause', syncPlaybackStateFunc);
    console.debug("PlaybackState update event registered.");
  }
}
