"use strict";

// prefix
const prefixId = 'com-matumo-dev-niconico-pip';

// PIPボタンの要素ID
const pipButtonElementId = `${prefixId}-pip-button`;
// PIP用のvideo要素のID
const pipVideoElementId = `${prefixId}-pip-video`;

// 動画再生ページのURLパターン（正規表現）
const nicoVideoPageUrlPatternRegExp = new RegExp('^https://www\\.nicovideo\\.jp/watch/.+$');

// PIP用のvideo要素のサイズ
const videoPipCanvasHeight = 720;
const videoPipCanvasWidth = 1280;

// PIPボタンの色
const pipButtonOnMouseOverColor = '#ffffff';
const pipButtonOnMouseOutColor = '#cccccc';

// ログ設定
const logPrefix = '[niconico-pip]';
let logLevel = 'log'; // ログレベル: 'error', 'warn', 'info', 'log', 'debug'
let logSufixType = 'none'; // ログのサフィックスタイプ: 'none', 'short', 'long'

// フォント設定
const fontFamily = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

const exec_config_config_js = async function() {
  // ストレージの設定を使って上書き
  logLevel = (debugMode && debug_log) ? 'debug' : 'log';
  logSufixType = (debugMode && debug_log) ? 'long' : 'none';
}
