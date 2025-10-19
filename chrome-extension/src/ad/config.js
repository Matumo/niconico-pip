"use strict";

// デバッグモード
let debugMode = false;

// prefix
const prefixId = 'com-matumo-dev-niconico-pip';

// ログ設定
const logPrefix = '[niconico-pip-ad]';
let logLevel = 'log'; // ログレベル: 'error', 'warn', 'info', 'log', 'debug'
let logSufixType = 'none'; // ログのサフィックスタイプ: 'none', 'short', 'long'

const exec_ad_config_js = async function() {
  // ストレージの設定を使って上書き
  debugMode = storageConfig[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
  logLevel = debugMode ? 'debug' : 'log';
  logSufixType = debugMode ? 'long' : 'none';
}
