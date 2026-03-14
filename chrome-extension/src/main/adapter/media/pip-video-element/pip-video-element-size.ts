/**
 * PiP動画要素サイズ計算
 */

// サイズ計算入力型
interface CalculatePipVideoElementSizeOptions {
  parentWidth: number;
  parentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

// サイズ計算結果型
interface PipVideoElementSize {
  width: number;
  height: number;
}

// PiP動画要素サイズを計算する関数
const calculatePipVideoElementSize = (
  options: CalculatePipVideoElementSizeOptions,
): PipVideoElementSize => {
  // 親要素サイズを整数pxへ正規化し、0以下にならないよう最小値1を保証する
  const parentWidth = Math.max(1, Math.floor(options.parentWidth));
  const parentHeight = Math.max(1, Math.floor(options.parentHeight));

  // canvas比率を維持したまま親要素内に収まるサイズを算出する
  let width: number;
  let height: number;
  if (parentWidth * options.canvasHeight <= parentHeight * options.canvasWidth) {
    // 横幅基準で収めるケース
    width = parentWidth;
    height = Math.floor((parentWidth * options.canvasHeight) / options.canvasWidth);
  } else {
    // 高さ基準で収めるケース
    height = parentHeight;
    width = Math.floor((parentHeight * options.canvasWidth) / options.canvasHeight);
  }

  // サイズを偶数にする
  // NOTE: グラフィック系の何らかの問題で、サイズを偶数にしないとPiP有効化時に要素の縁から光が漏れる
  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;
  // 偶数補正で親サイズを超えた場合は2px戻して再度範囲内へ収める
  if (width > parentWidth) width = Math.max(1, width - 2);
  if (height > parentHeight) height = Math.max(1, height - 2);

  return {
    width,
    height,
  };
};

// エクスポート
export { calculatePipVideoElementSize };
export type { CalculatePipVideoElementSizeOptions, PipVideoElementSize };
