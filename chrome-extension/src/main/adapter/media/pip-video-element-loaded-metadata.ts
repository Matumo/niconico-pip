/**
 * PiP動画要素 loadedmetadata待機
 */

// loadedmetadataまで待機する関数
const waitForLoadedMetadata = (
  videoElement: HTMLVideoElement,
  timeoutMs = 30 * 1000,
): Promise<boolean> => {
  // リスナー登録前に既にメタデータ取得済みなら即時でtrueを返す
  if (videoElement.readyState >= 1) return Promise.resolve(true);

  return new Promise((resolve) => {
    // 二重実行を防ぐフラグ
    let settled = false;
    // タイムアウトID
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    // この呼び出しで追加したリスナーだけを解除する
    const cleanup = (): void => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("error", handleError);
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // 待機終了時に呼び出す関数
    const settle = (loaded: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(loaded);
    };

    // メタデータ取得完了時はtrueで解決する
    const handleLoadedMetadata = (): void => settle(true);

    // 読み込み失敗時はfalseで解決する
    const handleError = (): void => settle(false);

    // ロード完了までイベント待機
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("error", handleError);
    timeoutId = globalThis.setTimeout(() => settle(false), timeoutMs);

    // リスナー登録後に取得完了へ遷移したケースを拾う
    if (videoElement.readyState >= 1) settle(true);
  });
};

// エクスポート
export { waitForLoadedMetadata };
