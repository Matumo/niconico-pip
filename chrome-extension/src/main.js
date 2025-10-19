"use strict";

(async function() {
  // ロガーを構築するまでは必ず処理を進める
  // 設定をロード
  await exec_config_storage_js();  // src/config/storage.js
  await loadStorageConfig();
  await exec_config_debug_js();    // src/config/debug.js
  await exec_config_config_js();   // src/config/config.js
  await exec_util_logger_js();     // src/util/logger.js

  // ロガー構築完了
  console.log("Main: Logger initialized.");

  // 拡張機能が無効化されていれば処理を中断
  if (!storageConfig[STORAGE_CONFIG_KEY_ENABLED]) {
    console.log('Extension is disabled. Exiting.');
    return;
  }

  // 設定関連のスクリプトを実行（実行済みのスクリプトを除く）
  console.log("Main: Executing configuration scripts...");
  await exec_config_event_js();   // src/config/event.js
  await exec_config_selector_js(); // src/config/selector.js
  await exec_ad_message_js();      // src/ad/message.js

  // コンテキスト関連のスクリプトを実行
  console.log("Main: Executing context scripts...");
  await exec_config_context_js();  // src/config/context.js

  // ユーティリティ関連のスクリプトを実行（ロガーは実行済みなので除外）
  console.log("Main: Executing utility scripts...");
  await exec_util_event_js();         // src/util/event.js
  await exec_util_context_js();       // src/util/context.js
  await exec_util_observer_js();      // src/util/observer.js
  await exec_util_status_js();        // src/util/status.js
  await exec_util_controller_js();    // src/util/controller.js
  await exec_util_pipStream_js();     // src/util/pipStream.js
  await exec_util_pipDraw_js();       // src/util/pipDraw.js
  await exec_util_time_js();          // src/util/time.js
  await exec_util_cache_js();         // src/util/cache.js
  await exec_util_supporterLogo_js(); // src/util/supporterLogo.js
  await exec_util_thumbnail_js();     // src/util/thumbnail.js
  await exec_util_ad_js();            // src/util/ad.js

  // 事前ハンドラ関連のスクリプトを実行
  console.log("Main: Executing pre-handler scripts...");
  await exec_pre_handler_status_js(); // src/pre-handler/status.js
  await exec_pre_handler_time_js();   // src/pre-handler/time.js

  // ハンドラ関連のスクリプトを実行
  console.log("Main: Executing handler scripts...");
  await exec_handler_page_js();          // src/handler/page.js
  await exec_handler_pipVideo_js();      // src/handler/pipVideo.js
  await exec_handler_pipStream_js();     // src/handler/pipStream.js
  await exec_handler_pipButton_js();     // src/handler/pipButton.js
  await exec_handler_mediaSession_js();  // src/handler/mediaSession.js
  await exec_handler_ad_js();            // src/handler/ad.js
  await exec_handler_pip_js();           // src/handler/pip.js
  await exec_handler_avoidNicoBugs_js(); // src/handler/avoidNicoBugs.js

  // オブザーバー関連のスクリプトを実行
  console.log("Main: Executing observer scripts...");
  await exec_observer_page_js();     // src/observer/page.js
  await exec_observer_elements_js(); // src/observer/elements.js
  await exec_observer_info_js();     // src/observer/info.js
  await exec_observer_timer_js();    // src/observer/timer.js

  // メイン処理開始
  console.log("Main: Starting main processes...");
  initChangeUrlObserver(); // ページ遷移監視の開始

  // デバッグ関連のスクリプトを実行
  console.log("Main: Executing debug scripts...");
  await exec_debug_js(); // src/debug.js

  console.log("Main: Initialization complete.");
})();
