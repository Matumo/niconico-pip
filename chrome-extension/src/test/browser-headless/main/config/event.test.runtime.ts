/**
 * event設定のランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap } from "@main/config/event";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const runTest = (): HeadlessBridgeDetails => {
  const config = createAppConfig();
  const eventNames = createAppEventNameMap(config.prefixId);
  const eventEntries = Object.entries(eventNames);
  const details: HeadlessBridgeDetails = {
    hasEntries: eventEntries.length > 0,
    uniqueNames: new Set(Object.values(eventNames)).size === eventEntries.length,
  };

  for (const [eventKey, eventName] of eventEntries) {
    details[`key:${eventKey}:notEmpty`] = eventKey.trim() !== "";
    details[`name:${eventKey}:notEmpty`] = eventName.trim() !== "";
    details[`name:${eventKey}:containsPrefix`] = eventName.includes(config.prefixId);
    details[`name:${eventKey}:containsEventToken`] = eventName.includes("-event-");
  }

  return details;
};

// エクスポート
export { runTest };
