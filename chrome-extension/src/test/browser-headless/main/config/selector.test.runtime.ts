/**
 * selector設定のランタイムテスト
 */
import { discoverPlayerTargetSelectors, selectorDefinitions } from "@main/config/selector";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const runTest = (): HeadlessBridgeDetails => {
  const selectorKeys = Object.keys(selectorDefinitions) as Array<keyof typeof selectorDefinitions>;
  const details: HeadlessBridgeDetails = {
    hasSelectorKeys: selectorKeys.length > 0,
    hasDiscoverPlayerTargetSelectors: discoverPlayerTargetSelectors.length > 0,
  };

  for (const selector of discoverPlayerTargetSelectors) {
    const notEmpty = selector.trim() !== "";
    details[`discoverTarget:${selector}:notEmpty`] = notEmpty;
    details[`discoverTarget:${selector}:querySelectorMatched`] =
      notEmpty && document.querySelector(selector) !== null;
  }

  for (const key of selectorKeys) {
    const { primary, fallbacks } = selectorDefinitions[key];
    const selectors = [primary, ...fallbacks];
    details[`${String(key)}:primaryNotEmpty`] = primary.trim() !== "";

    for (const fallback of fallbacks) {
      details[`${String(key)}:fallback:${fallback}:notEmpty`] = fallback.trim() !== "";
    }

    const hasMatchedSelector = selectors.some((selector) => document.querySelector(selector) !== null);
    details[`${String(key)}:hasMatchedSelector`] = hasMatchedSelector;
  }

  return details;
};

// エクスポート
export { runTest };
