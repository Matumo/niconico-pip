"use strict";

(async function() {
  // ロガーを構築するまでは必ず処理を進める
  // 設定をロード
  await exec_config_storage_js();  // src/config/storage.js
  await loadStorageConfig();

  await exec_ad_config_js();    // src/ad/config.js
  await exec_util_logger_js();  // src/util/logger.js

  // ロガー構築完了
  console.log("Main: Logger initialized.");

  // 拡張機能が無効化されていれば処理を中断
  if (!storageConfig[STORAGE_CONFIG_KEY_ENABLED]) {
    console.log('Extension is disabled. Exiting.');
    return;
  }

  // メイン処理開始
  await exec_ad_message_js();   // src/ad/message.js
  await exec_ad_ad_js();        // src/ad/ad.js

  console.log("Main: Initialization complete.");
})();
