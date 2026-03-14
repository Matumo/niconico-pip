/**
 * pipランタイム補助のブラウザランタイムテスト
 */
import {
  canUseNativeEventApi,
  hasAnyPipElement,
  resolveEventTarget,
} from "@main/domain/pip/pip-runtime";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const withDocumentProperty = <T>(
  key: keyof Document,
  value: unknown,
  run: () => T,
): T => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.document, key);
  Object.defineProperty(globalThis.document, key, {
    configurable: true,
    value,
  });

  try {
    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis.document, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis.document, key);
    }
  }
};

const runTest = (): HeadlessBridgeDetails => {
  const fakePipElement = globalThis.document.createElement("video");

  return {
    eventTargetResolved: resolveEventTarget() === globalThis,
    nativeEventApiAvailable: canUseNativeEventApi(),
    noPipInitially: hasAnyPipElement() === false,
    pipDetectedWithShimmedDocument: withDocumentProperty(
      "pictureInPictureElement",
      fakePipElement,
      () => hasAnyPipElement() === true,
    ),
  };
};

// エクスポート
export { runTest };
