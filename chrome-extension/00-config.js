
const prefixId = 'com-matumo-dev-niconico-pip';
const pipButtonElementId = `${prefixId}-pip-button`;
const pipVideoElementId = `${prefixId}-pip-video`;

const videoPipCanvasHeight = 1080;
const videoPipCanvasWidth = 1920;

const pipButtonOnMouseOverColor = '#ffffff';
const pipButtonOnMouseOutColor = '#cccccc';

// PIPボタンの後ろに位置する要素（コメント非表示ボタン）のセレクタ
const tooltipButtonElementSelector = '[id="tooltip::rb::trigger"], [id="tooltip:«rb»:trigger"], ' +
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを非表示にする"], ' +
  'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを表示する"]'
// PIP用のvideo要素を入れる要素のセレクタ
const r3ElementSelector = '[data-styling-id=":r3:"], [data-styling-id="«r3»"], ' +
  'div.grid-area_\\[player\\] > div > div > div[data-styling-id]';
// 既存video要素とコメントキャンバスが入っているコンテナ要素のセレクタ（動画が変わるとこの要素が変わる）
const r5ElementSelector = '[id="menu::r5::ctx-trigger"], [id="menu:«r5»:ctx-trigger"], ' +
 'div.grid-area_\\[player\\] > div > div > div[data-styling-id] > div[data-scope="menu"][data-part="context-trigger"]';
// 既存video要素のセレクタ
const nicoVideoElementSelector = '[data-name="content"] > video';
// コメントキャンバスのセレクタ
const nicoCommentsElementSelector = 'div[data-name="comment"] > canvas';

// バックオフ実装用
const waitForElementsIntervalTimeMin = 10;  // 待機間隔時間の最小値（ミリ秒）
const waitForElementsIntervalTimeMax = 100; // 待機間隔時間の最大値（ミリ秒）
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
const nicoVideoPageUrlPatternRegExp = new RegExp('^https://www\\.nicovideo\\.jp/watch/\\w+$');

// シークバーのデフォルトのシークオフセット（秒）
const seekBackwardDefaultOffset = 10;
const seekForwardDefaultOffset = 10;
