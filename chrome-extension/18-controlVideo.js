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
      if (!isVideoPipElementActive) {
        // videoPipElementがアクティブでない場合は一時停止
        videoPipElement.pause();
      } else {
        // videoPipElementがアクティブな場合はステータスを同期
        if (isPlaying) videoPipElement.play();
        else videoPipElement.pause();
      }
    }
    // MediaSessionのplaybackStateを更新
    if (isMediaSessionSupported()) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  // ニコニコ動画のバグ対策
  function avoidSeekBug() {
    // 動画の最後（コメントが塊で流れるタイミング）でシークバーを使わず動画をシークすると、
    // 動画だけがシークされて、コメントやシークバーはシークされないバグがある
    // 暫定対処として、シークバーの線をクリックすることで動画冒頭に戻ると制御をリセットする
    const currentTimeElem = document.querySelector('div[aria-label="video - currentTime"]');
    const prevElem = currentTimeElem && currentTimeElem.previousElementSibling;
    if (prevElem) prevElem.click();
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
    // シークバグを回避
    avoidSeekBug();
    // 動画をシーク
    nicoVideoElement.currentTime = normalizedSeekTime;
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
    if (lastSyncPlaybackStateFunc) {
      try {
        nicoVideoElement.removeEventListener('play', lastSyncPlaybackStateFunc);
        nicoVideoElement.removeEventListener('pause', lastSyncPlaybackStateFunc);
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
