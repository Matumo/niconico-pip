/**
 * config設定のランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const runTest = (): HeadlessBridgeDetails => {
  const config = createAppConfig();

  const details: HeadlessBridgeDetails = {
    appName: config.appName.trim() !== "",
    prefixId: config.prefixId.trim() !== "",
    watchPageUrlPatternSource: config.watchPageUrlPattern.source.trim() !== "",
    pipButtonElementId: config.pipButtonElementId.includes(config.prefixId),
    pipVideoElementId: config.pipVideoElementId.includes(config.prefixId),
    pipButtonOnMouseOverColor: config.pipButtonOnMouseOverColor.trim() !== "",
    pipButtonOnMouseOutColor: config.pipButtonOnMouseOutColor.trim() !== "",
    videoPipCanvasHeight: config.videoPipCanvasHeight > 0,
    videoPipCanvasWidth: config.videoPipCanvasWidth > 0,
    seekBackwardDefaultOffset: config.seekBackwardDefaultOffset > 0,
    seekForwardDefaultOffset: config.seekForwardDefaultOffset > 0,
  };

  return details;
};

// エクスポート
export { runTest };
