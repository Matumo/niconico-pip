
const prefixId = 'com-matumo-dev-niconico-pip';
const pipButtonElementId = `${prefixId}-pip-button`;
const pipVideoElementId = `${prefixId}-pip-video`;

const videoPipCanvasHeight = 1080;
const videoPipCanvasWidth = 1920;

const pipButtonOnMouseOverColor = '#ffffff';
const pipButtonOnMouseOutColor = '#cccccc';

// PIPボタンの後ろに位置する要素（コメント非表示ボタン）のセレクタ
const tooltipButtonElementSelector = '[id="tooltip::rb::trigger"], [id="tooltip:«rb»:trigger"]';
// PIP用のvideo要素を入れる要素のセレクタ（既存video要素と同じ要素に兄弟として入れる）
const r3ElementSelector = '[data-styling-id=":r3:"], [data-styling-id="«r3»"]';
// 既存video要素とコメントキャンバスが入っているコンテナ要素のセレクタ（動画が変わるとこの要素が変わる）
const r5ElementSelector = '[id="menu::r5::ctx-trigger"], [id="menu:«r5»:ctx-trigger"]';
// 既存video要素のセレクタ
const nicoVideoElementSelector = '[data-name="content"] > video';
// コメントキャンバスのセレクタ
const nicoCommentsElementSelector = 'div[data-name="comment"] > canvas';

const waitForElementsIntervalTime = 100;
const waitForElementsTimeout = 2 * 60 * 1000;
const waitForElementsSelectors = [
  tooltipButtonElementSelector,
  r3ElementSelector,
  r5ElementSelector,
  nicoVideoElementSelector,
  nicoCommentsElementSelector,
];

const nicoVideoElementChangedEventName = 'nicoVideoElementChanged';
