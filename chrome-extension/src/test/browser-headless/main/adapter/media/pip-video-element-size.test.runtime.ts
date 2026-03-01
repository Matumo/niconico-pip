/**
 * PiP動画要素サイズ計算アダプターのランタイムテスト
 */
import { calculatePipVideoElementSize } from "@main/adapter/media/pip-video-element-size";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const runTest = (): HeadlessBridgeDetails => {
  const floorNormalized = calculatePipVideoElementSize({
    parentWidth: 640.9,
    parentHeight: 360.9,
    canvasWidth: 1280,
    canvasHeight: 720,
  });
  const wideBranch = calculatePipVideoElementSize({
    parentWidth: 800,
    parentHeight: 300,
    canvasWidth: 1280,
    canvasHeight: 720,
  });
  const oddOverflowAdjusted = calculatePipVideoElementSize({
    parentWidth: 99,
    parentHeight: 300,
    canvasWidth: 1280,
    canvasHeight: 720,
  });
  const tinyParentHandled = calculatePipVideoElementSize({
    parentWidth: 1,
    parentHeight: 1,
    canvasWidth: 1280,
    canvasHeight: 720,
  });

  return {
    floorNormalized: floorNormalized.width === 640 && floorNormalized.height === 360,
    wideBranchCalculated: wideBranch.width === 534 && wideBranch.height === 300,
    oddOverflowAdjusted: oddOverflowAdjusted.width === 98 && oddOverflowAdjusted.height === 56,
    tinyParentHandled: tinyParentHandled.width === 1 && tinyParentHandled.height === 0,
  };
};

// エクスポート
export { runTest };
