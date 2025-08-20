"use strict";

// ストリームのステータスチェック処理
{
  // プレイヤーのステータス変更時に毎回ストリームを新しく開始する
  // 予約フラグ変数
  let restartRegistered = false;
  addEventListener(window, "広告関連のステータス更新時にストリームを開始または再開",
                   statusChangedEventName, (event) => {
    const { detail } = event;
    const status = detail.status;
    const prevStatus = detail.prevStatus;
    // ステータスが変わっていない場合は何もしない
    if (prevStatus.type === status.type) return;
    // 前後のステータスのどちらかがadでない場合は何もしない
    if (!prevStatus.type?.startsWith('ad-') && !status.type?.startsWith('ad-')) return;
    // 過度な多重実行防止: 予約フラグが立っていなければ、500ms後にストリームを開始
    if (!restartRegistered) {
      restartRegistered = true;
      setTimeout(() => {
        restartRegistered = false;
        if (context.pip.status !== "enabled") return; // PIPが有効でない場合は何もしない
        startStream(); // ストリームを開始
      }, 150);
      console.debug("Stream restart registered for status change:", status.type);
    } else {
      console.debug("Stream restart already registered, skipping this event.");
    }
  });
}
