"use strict";

// ページ読み込み時の初期化処理
const exec_handler_page_js = async function() {
  // pageUrlChangedEventNameのイベントハンドラ
  addEventListener(window, "ページURL変更時に初期化", pageUrlChangedEventName, function (event) {
    console.info("-------------    New Page     -------------");
    console.info("     --------     Clear       --------     ");

    console.debug("Page URL changed event received:", event.detail);

    // 既存の要素監視を停止
    stopElementObserver();
    // 動画情報の監視を停止
    stopInfoObserver();

    // 要素のコンテキストをクリア
    clearElementContext();
    // 動画情報のコンテキストをクリア
    clearInfoContext();
    // ステータスのコンテキストをクリア
    //clearStatusContext();
    // 時間のコンテキストをクリア
    clearTimeContext();

    console.info("     --------   Start Update   --------     ");

    // 動画再生ページかどうかを確認
    const isWatchPage = event.detail.isWatchPage;

    // 動画再生ページでない場合は何もしない
    if (!isWatchPage) {
      console.debug("This is not a video watch page.");
      return;
    }

    // 動画再生ページの場合は処理を開始
    console.debug("This is a video watch page.");

    // 動画ページの要素監視を開始
    startElementObserver();
    // 動画情報の監視を開始
    startInfoObserver();

    console.info("     --------    Updating...    --------     ");
  });
}
