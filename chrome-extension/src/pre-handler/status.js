"use strict";

// ステータスの更新処理
const exec_pre_handler_status_js = async function() {
  // タイマーが更新されるときにステータスを更新する
  addEventListener(window, "タイマー更新時にステータス変化をチェック",
                   videoTimeChangedEventName, () => {
    //console.debug("Timer updated. Checking status...");
    //checkStatus();
  });

  // 要素が変更されたときにステータスを更新する
  addEventListener(window, "要素変更時にステータス変化をチェック",
                  elementChangedEventName, () => {
    //console.debug("Element changed. Checking status...");
    checkStatus();
  });

  // Observerがcallbackを実行したときにステータスを更新する
  addEventListener(window, "Observerがcallbackを実行したときにステータス変化をチェック",
                  observerCallbackEventName, () => {
    //console.debug("Observer callback executed. Checking status...");
    checkStatus();
  });

  // ステータスが変更されたときにログを出力
  addEventListener(window, "ステータス変更時にログを出力", statusChangedEventName, (event) => {
    const { detail } = event;
    const status = detail.status;
    const type = status.type;
    const details = status.details;
    const playing = status.playing;
    console.log(`Status changed: ${playing ? 'Playing' : 'Paused'},`,
                `Type: ${type || 'Unknown'}, Details: ${details || 'None'}`);
  });

  // バグ対策: ステータスが変更されたときにコントローラーをクリック
  let avoidStatusBugId = 0;
  let avoidStatusBugLastTime = 0;
  const avoidStatusBugTimeout = 1000; // 1000ms以内に連続実行しないように制御
  addEventListener(window, "ステータス変更時にコントローラーをクリックしてバグ回避",
                  statusChangedEventName, (event) => {
    // 広告が2本連続で再生されるとき、2本目でシークバーが動作しないバグがある
    // コントローラーをクリックすることで再度アクティブになるので、クリックイベントを発火させる
    // または、1秒ごとにステータスチェックを呼び出す

    // typeが同じ場合はスキップ
    const { detail } = event;
    const status = detail.status;
    const prevStatus = detail.prevStatus;

    // ステータスがadではない場合はスキップ
    if (!status.type?.includes("ad-")) return;

    // TODO: ここに実装
  });
}
