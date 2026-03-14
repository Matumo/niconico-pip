/**
 * domain共通 EventTarget解決のブラウザランタイムテスト
 */
import { resolveEventTarget } from "@main/domain/shared/resolve-event-target";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const withGlobalProperty = <T>(
  key: "dispatchEvent",
  value: unknown,
  run: () => T,
): T => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  });

  try {
    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
};

const runTest = (): HeadlessBridgeDetails => ({
  eventTargetResolved: resolveEventTarget() === globalThis,
  eventTargetUnavailableWithoutDispatchEvent: withGlobalProperty(
    "dispatchEvent",
    undefined,
    () => resolveEventTarget() === null,
  ),
});

// エクスポート
export { runTest };
