/**
 * domain共通 EventTarget解決
 */
type BrowserGlobal = typeof globalThis & {
  dispatchEvent?: (event: Event) => boolean;
};

// globalThisをEventTargetとして扱えるか判定する関数
const resolveEventTarget = (): EventTarget | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  if (typeof browserGlobal.dispatchEvent !== "function") return null;
  return browserGlobal as unknown as EventTarget;
};

// エクスポート
export { resolveEventTarget };
