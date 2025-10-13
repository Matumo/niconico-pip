"use strict";

// ニコニコ動画のバグ回避ワークアラウンド
{
  // 動画終了時の再生ステータスに差異があるバグの回避
  // https://github.com/Matumo/niconico-pip/issues/33
  // https://github.com/Matumo/niconico-pip/issues/34
  let debug_flag = false;
  addEventListener(window, "ニコニコ動画のバグ回避ワークアラウンド", videoTimeChangedEventName, () => {
    // ステータス取得
    const status = context.status;
    const position = getSeekBarCurrentTime();
    const duration = getSeekBarDuration();
    // typeがsupporterまたはvideo、かつpositionがdurationと同じ場合にバグが発生する
    if ((status.type === "supporter" || status.type === "video") && position === duration) {
      if (debug_flag) {
        // 既に停止済みであるためスキップ
        console.debug("Avoid Nico Bugs: Detected video end state again, but already handled.");
      } else {
        debug_flag = true;
        // リピート再生と次の動画自動再生が両方オフ、かつPiPが有効な場合のみ停止を実行
        //   この処理が動くと動画冒頭で停止する（オリジナルの挙動は動画末尾で停止する）
        //   なるべく挙動を変えたくないので、実行条件を厳しめに設定している
        //   PiP有効時にPiPで操作不能になるのが一番の問題であり、元動画では一応操作可能なのでバグがあっても問題ない
        //   また、PiPは動画末尾で描画を停止しているため、動画冒頭に戻しても見た目上は差異がない
        //   PiPを終了すると元動画の停止位置が動画冒頭になっているのは差異になるが、コーナーケースと考え妥協する
        const loopAndContinuous = getLoopAndContinuousState();
        const isPip = context.pip.status === "enabled";
        console.debug("Avoid Nico Bugs: Detected video end state.",
                      {status, position, duration, loopAndContinuous, isPip});
        if (loopAndContinuous.loop == false && loopAndContinuous.isContinuous == false && isPip) {
          playerController_stop(); // 停止
          console.debug("Avoid Nico Bugs: Stopped playback because the required conditions are met.");
        } else {
          console.debug("Avoid Nico Bugs: Not stopping because the required conditions are not met.");
        }
      }
    } else {
      // バグ回避済み（バグが発生しないステータス）かつフラグが立ったままの場合はフラグを下ろす
      if (debug_flag) debug_flag = false;
    }
  });

  // 「リピート再生」と「次の動画を自動再生」の状態フラグ取得
  function getLoopAndContinuousState() {
    const key = "@nvweb-packages/video-renderer";
    const json = localStorage.getItem(key);
    const res = {
      loop: null,
      isContinuous: null
    };
    if (json) {
      const data = JSON.parse(json)?.data || {};
      res.loop = data.loop?.data ?? null;
      res.isContinuous = data.isContinuous?.data ?? null;
    }
    return res;
  }
}
