/**
 * セレクタ設定
 */
// 要素ごとのセレクタ定義型
type SelectorDefinition<TElement extends Element> = {
  primary: string;     // 要素取得の第一候補セレクタ
  fallbacks: string[]; // primary不一致時に順に試す代替セレクタ
  guard: (elem: Element) => elem is TElement; // 型ガード
};

// 要素キーとDOM型の対応定義
interface SelectorElementMap {
  tooltipButton: HTMLButtonElement;  // コメント表示切替トリガーのボタン要素
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

// 要素取得に利用するセレクタ定義
const selectorDefinitions: SelectorDefinitions = {
  tooltipButton: {
    primary: 'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを非表示にする"]',
    fallbacks: ['button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを表示する"]'],
    guard: isButtonElement,
  },
  playerContainer: {
    primary: String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div:has([data-scope="menu"])`,
    fallbacks: [],
    guard: isDivElement,
  },
  playerMenu: {
    primary: String.raw`div.grid-area_\[player\] div[data-scope="menu"]`,
    fallbacks: [],
    guard: isDivElement,
  },
  video: {
    primary: '[data-name="content"] > video',
    fallbacks: [],
    guard: isVideoElement,
  },
  commentsCanvas: {
    primary: 'div[data-name="comment"] > canvas',
    fallbacks: [],
    guard: isCanvasElement,
  },
};

// エクスポート
export { selectorDefinitions };
export type { SelectorElementMap, SelectorKey, SelectorDefinitions };
