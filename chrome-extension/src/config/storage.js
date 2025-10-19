"use strict";

// 拡張機能のストレージで保持する設定

// --- variable ----------------------------------------------------------------
const STORAGE_CONFIG_KEY_PREFIX = 'config';
// 拡張機能の有効化設定キー
const STORAGE_CONFIG_KEY_ENABLED = `${STORAGE_CONFIG_KEY_PREFIX}Enabled`;
// デバッグモード有効化設定キー
const STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED = `${STORAGE_CONFIG_KEY_PREFIX}DebugModeEnabled`;
// デバッグログ有効化設定キー
const STORAGE_CONFIG_KEY_DEBUG_LOG_ENABLED = `${STORAGE_CONFIG_KEY_PREFIX}DebugLogEnabled`;
// 広告自動スキップ有効化設定キー
const STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED = `${STORAGE_CONFIG_KEY_PREFIX}AdAutoSkipEnabled`;
const storageConfig = {
  [STORAGE_CONFIG_KEY_ENABLED]: true,
  [STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED]: false,
  [STORAGE_CONFIG_KEY_DEBUG_LOG_ENABLED]: false,
  [STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED]: false,
};
// -----------------------------------------------------------------------------

// --- function ----------------------------------------------------------------
let setStorageConfig = null;
let loadStorageConfig = null;
// -----------------------------------------------------------------------------

const exec_config_storage_js = async function() {
  // 設定値のセッター
  setStorageConfig = async function(key, value) {
    console.log(`Setting config: ${key} = ${value}`);
    await chrome.storage.local.set({ [key]: value });
    storageConfig[key] = value;
    console.log(`Config ${key} set to ${value}`);
  }

  // ストレージから設定を取得
  loadStorageConfig = async function() {
    console.log('Loading config from storage...');
    const keys = Object.keys(storageConfig);
    const getConfig = await chrome.storage.local.get(keys);
    let notFound = false; // 未設定のキーがあったかどうか
    keys.forEach((key) => {
      if (getConfig[key] === undefined) {
        notFound = true;
      } else {
        storageConfig[key] = getConfig[key];
      }
    });
    // 未設定のキーがあった場合はストレージに保存しておく
    if (notFound) {
      await chrome.storage.local.set(storageConfig);
      console.log('Some config keys were not found. Saved default config to storage.');
    }
    console.log('Config loaded:', storageConfig);
  }
}
