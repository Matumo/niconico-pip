
const prefixId = 'com-matumo-dev-niconico-pip';
const pipButtonElementId = `${prefixId}-pip-button`;
const pipVideoElementId = `${prefixId}-pip-video`;

const videoPipCanvasHeight = 1080;
const videoPipCanvasWidth = 1920;

const pipButtonOnMouseOverColor = '#ffffff';
const pipButtonOnMouseOutColor = '#cccccc';

const tooltipButtonElementSelector = '[id="tooltip::rb::trigger"]';
const r3ElementSelector = '[data-styling-id=":r3:"]';
const r5ElementSelector = '[id="menu::r5::ctx-trigger"]';
const nicoVideoElementSelector = '[data-name="content"] > video';
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
