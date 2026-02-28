/**
 * セレクタ設定
 */
// 要素ごとのセレクタ定義型
type SelectorDefinition<TElement extends Element> = {
  primary: string;     // 要素取得の第一候補セレクタ
  fallbacks: string[]; // primary不一致時に順に試す代替セレクタ
  guard: (elem: Element) => elem is TElement; // 型ガード
  validate: (elem: TElement) => boolean; // 期待する要素かどうか判定
};

// 要素キーとDOM型の対応定義
interface SelectorElementMap {
  commentToggleButton: HTMLButtonElement;  // コメントトグルボタン要素
  playerContainer: HTMLDivElement;   // プレイヤー全体を包むコンテナ要素
  playerMenu: HTMLDivElement;        // プレイヤーのメニュー領域要素
  video: HTMLVideoElement;           // 再生対象のvideo要素
  commentsCanvas: HTMLCanvasElement; // コメント描画に使うcanvas要素
}

// セレクタキー型
type SelectorKey = keyof SelectorElementMap;
// セレクタ定義マップ型
type SelectorDefinitions = {
  [K in SelectorKey]: SelectorDefinition<SelectorElementMap[K]>;
};

// タグ名が一致するか判定する関数
const hasTagName = (elem: Element, expectedTagName: string): boolean => {
  const tagName = elem.tagName?.toLowerCase();
  return tagName === expectedTagName;
};

// button要素か判定する関数
const isButtonElement = (elem: Element): elem is HTMLButtonElement => hasTagName(elem, "button");
// div要素か判定する関数
const isDivElement = (elem: Element): elem is HTMLDivElement => hasTagName(elem, "div");
// video要素か判定する関数
const isVideoElement = (elem: Element): elem is HTMLVideoElement => hasTagName(elem, "video");
// canvas要素か判定する関数
const isCanvasElement = (elem: Element): elem is HTMLCanvasElement => hasTagName(elem, "canvas");

// tooltipボタン用の共通セレクタ前方
const commentToggleButtonSelectorPrefix = `button[data-scope="tooltip"][data-part="trigger"]`;
// プレイヤー領域用の共通セレクタ前方
const playerAreaSelectorPrefix = String.raw`div.grid-area_\[player\]`;
// discover監視で使うtarget候補セレクタ（厳しい順）
const discoverPlayerTargetSelectors = [
  "body > #root main",
  "body > #root",
  "body",
] as const;
// selectorだけで判定可能な要素は追加検証を行わない
const validateNoop = <TElement extends Element>(_: TElement): boolean => true;

// 要素取得に利用するセレクタ定義
const selectorDefinitions: SelectorDefinitions = {
  commentToggleButton: {
    primary: `${commentToggleButtonSelectorPrefix}[aria-label="コメントを非表示にする"], ${commentToggleButtonSelectorPrefix}[aria-label="コメントを表示する"]`,
    fallbacks: [],
    guard: isButtonElement,
    validate: validateNoop,
  },
  playerContainer: {
    primary: `${playerAreaSelectorPrefix} > div.PlayerPresenter > div > div:has([data-scope="menu"])`,
    fallbacks: [],
    guard: isDivElement,
    validate: validateNoop,
  },
  playerMenu: {
    primary: `${playerAreaSelectorPrefix} div[data-scope="menu"]`,
    fallbacks: [],
    guard: isDivElement,
    validate: validateNoop,
  },
  video: {
    primary: `[data-name="content"] > video`,
    fallbacks: [],
    guard: isVideoElement,
    validate: validateNoop,
  },
  commentsCanvas: {
    primary: `div[data-name="comment"] > canvas`,
    fallbacks: [],
    guard: isCanvasElement,
    validate: validateNoop,
  },
};

// エクスポート
export { selectorDefinitions, discoverPlayerTargetSelectors };
export type { SelectorElementMap, SelectorKey, SelectorDefinitions };
