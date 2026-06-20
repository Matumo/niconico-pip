
const prefixId = 'com-matumo-dev-niconico-pip';
const pipButtonElementId = `${prefixId}-pip-button`;
const pipVideoElementId = `${prefixId}-pip-video`;

const videoPipCanvasHeight = 720;
const videoPipCanvasWidth = 1280;

const pipButtonOnMouseOverColor = '#ffffff';
const pipButtonOnMouseOutColor = '#cccccc';

// PIPボタンの後ろに位置する要素（コメント非表示ボタン）のセレクタ
const tooltipButtonElementSelector =
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを非表示にする"], ' +
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを表示する"]'
// PIP用のvideo要素を入れる要素のセレクタ
const r3ElementSelector =
  'div.grid-area_\\[player\\] > div.PlayerPresenter > div > div:has([data-scope="menu"])';
// 既存video要素とコメントキャンバスが入っているコンテナ要素のセレクタ（動画が変わるとこの要素が変わる）
const r5ElementSelector = 'div.grid-area_\\[player\\] div[data-scope="menu"]'; // r4
// 既存video要素のセレクタ
const nicoVideoElementSelector = '[data-name="content"] > video';
// コメントキャンバスのセレクタ
const nicoCommentsElementSelector = 'div[data-name="comment"] > canvas';

// ニコニコショート用セレクタ
// アクティブなショート動画（video/コメントが複数同時に存在するため active で絞る）
const shortsActiveEntrySelector =
  '[data-playlist-type="shorts"][data-playlist-state="active"]';
// ショートのPIPボタン挿入位置
const shortsPipButtonAnchorSelector =
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを非表示にする"], ' +
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを表示する"]';
// コメントトグルが見つからない場合の代替アンカー（再生/一時停止トグル）
const shortsPipButtonAnchorFallbackSelector =
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="一時停止する"], ' +
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="再生する"]';
// ショートPIP用canvasの短辺基準サイズ（縦横比はコメントcanvasに追従）
const shortsPipCanvasBaseSize = 720;
// ショートPIPの縦長クランプ
//   0.8  = 4:5    窓高さ 1.25×幅 （バランス）
//   0.75 = 3:4    窓高さ 1.33×幅 （9:16寄り）
//   1.0  = 1:1    窓高さ 1.00×幅 （正方形）
//   0    = 無効
const shortsPipMinAspectRatio = 0;

// バックオフ実装用
const waitForElementsIntervalTimeMin = 10;  // 待機間隔時間の最小値（ミリ秒）
const waitForElementsIntervalTimeMax = 500; // 待機間隔時間の最大値（ミリ秒）
const waitForElementsIntervalTimeStep = 10; // 待機間隔時間の増加ステップ（ミリ秒）
const waitForElementsIntervalTimeLoopCount = 10; // 待機間隔の見直し間隔（このループ回数を超えたら再設定する）
const waitForElementsTimeout = 2 * 60 * 1000;    // タイムアウト時間（待機時間の見直しと同時にチェックする）
// 取得対象の要素セレクタ
const waitForElementsSelectors = [
  tooltipButtonElementSelector,
  r3ElementSelector,
  r5ElementSelector,
  nicoVideoElementSelector,
  nicoCommentsElementSelector,
];

// Video要素の変更イベント名
const nicoVideoElementChangedEventName = `${prefixId}-nicoVideoElementChanged`;
// サイトURLの変更イベント名
const nicoVideoPageUrlChangedEventName = `${prefixId}-nicoVideoPageUrlChanged`;
// 動画再生ページのURLパターン（正規表現）
const nicoVideoPageUrlPatternRegExp = new RegExp('^https://www\\.nicovideo\\.jp/watch/.+$');
// ショート動画ページのURLパターン（正規表現）
const nicoShortsPageUrlPatternRegExp = new RegExp('^https://www\\.nicovideo\\.jp/shorts/.+$');

// シークバーのデフォルトのシークオフセット（秒）
const seekBackwardDefaultOffset = 10;
const seekForwardDefaultOffset = 10;

// ログ設定
const logPrefix = '[niconico-pip]';
const logLevel = debugMode ? 'debug' : 'log'; // ログレベル: 'error', 'warn', 'info', 'log', 'debug'
const logSufixType = debugMode ? 'long' : 'none'; // ログのサフィックスタイプ: 'none', 'short', 'long'
