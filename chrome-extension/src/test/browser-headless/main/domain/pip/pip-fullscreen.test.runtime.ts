/**
 * pip fullscreen補助のブラウザランタイムテスト
 */
import type { PipDomainRuntime, ResolvePipRuntime } from "@main/domain/pip/pip-runtime";
import {
  fullscreenToggleObserverKey,
  requestExitBrowserSizeFullscreenForOwnPipEnter,
  requestExitOwnPictureInPicture,
  syncFullscreenToggleObserver,
} from "@main/domain/pip/pip-fullscreen";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const withDocumentProperty = async <T>(
  key: keyof Document,
  value: unknown,
  run: () => Promise<T> | T,
): Promise<T> => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.document, key);
  Object.defineProperty(globalThis.document, key, {
    configurable: true,
    value,
  });

  try {
    return await run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis.document, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis.document, key);
    }
  }
};

const createRuntime = (): {
  runtime: PipDomainRuntime;
  observeCalls: Array<{
    key: string;
    target: Node;
  }>;
  disconnectCalls: string[];
  resolveRuntime: ResolvePipRuntime;
  getObserverCallback: () => MutationCallback | null;
} => {
  const observeCalls: Array<{
    key: string;
    target: Node;
  }> = [];
  const disconnectCalls: string[] = [];
  let observerCallback: MutationCallback | null = null;

  const runtime = {
    context: {
      observerRegistry: {
        observe: (params: {
          key: string;
          target: Node;
          callback: MutationCallback;
        }) => {
          observeCalls.push({
            key: params.key,
            target: params.target,
          });
          observerCallback = params.callback;
          return { disconnect: () => undefined } as unknown as MutationObserver;
        },
        disconnect: (key: string) => {
          disconnectCalls.push(key);
          return true;
        },
      },
    },
    pipVideoElementAdapter: {
      isOwnPictureInPictureElement: () => true,
    },
    fullscreenToggleButton: null,
    browserSizeFullscreenActive: null,
  } as unknown as PipDomainRuntime;

  return {
    runtime,
    observeCalls,
    disconnectCalls,
    resolveRuntime: () => runtime,
    getObserverCallback: () => observerCallback,
  };
};

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const {
    runtime,
    observeCalls,
    disconnectCalls,
    resolveRuntime,
    getObserverCallback,
  } = createRuntime();

  let ownExitCallCount = 0;
  const ownExitRequested = await withDocumentProperty(
    "exitPictureInPicture",
    async () => {
      ownExitCallCount += 1;
    },
    async () => {
      requestExitOwnPictureInPicture(runtime, "browser-runtime");
      await Promise.resolve();
      return ownExitCallCount === 1;
    },
  );

  const fullscreenToggleButton = globalThis.document.createElement("button");
  fullscreenToggleButton.setAttribute("aria-label", "全画面表示を終了");
  let clickCount = 0;
  fullscreenToggleButton.click = () => {
    clickCount += 1;
  };
  runtime.fullscreenToggleButton = fullscreenToggleButton;
  requestExitBrowserSizeFullscreenForOwnPipEnter(runtime, "browser-runtime");
  const browserSizeExitClicked = clickCount === 1;

  const observerButton = globalThis.document.createElement("button");
  observerButton.setAttribute("aria-label", "全画面表示する");
  let exitRequestCount = 0;
  await withDocumentProperty("exitPictureInPicture", async () => {
    exitRequestCount += 1;
  }, async () => {
    syncFullscreenToggleObserver({
      runtime,
      nextFullscreenToggleButton: observerButton,
      resolveRuntime,
    });
    observerButton.setAttribute("aria-label", "全画面表示を終了");
    getObserverCallback()?.([
      {
        type: "attributes",
        attributeName: "aria-label",
      } as MutationRecord,
    ], {} as MutationObserver);
    await Promise.resolve();
  });

  const observerStartedAndTriggeredExit = observeCalls.length === 1 &&
    observeCalls[0]?.key === fullscreenToggleObserverKey &&
    observeCalls[0]?.target === observerButton &&
    runtime.fullscreenToggleButton === observerButton &&
    runtime.browserSizeFullscreenActive === true &&
    exitRequestCount === 1;

  syncFullscreenToggleObserver({
    runtime,
    nextFullscreenToggleButton: null,
    resolveRuntime,
  });
  const observerDisconnectedAndCleared = disconnectCalls.includes(fullscreenToggleObserverKey) &&
    runtime.fullscreenToggleButton === null &&
    runtime.browserSizeFullscreenActive === null;

  return {
    ownExitRequested,
    browserSizeExitClicked,
    observerStartedAndTriggeredExit,
    observerDisconnectedAndCleared,
  };
};

// エクスポート
export { runTest };
