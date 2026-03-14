/**
 * debug dump triggerのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createDebugDumpRegistry } from "@main/debug/debug-dump-registry";
import { createDebugDumpRequestEventName, installDebugDumpTrigger } from "@main/debug/debug-dump-trigger";
import type { AppContext, AppEventRegistry, AppObserverRegistry } from "@main/types/app-context";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const createContext = (): AppContext => {
  const eventRegistry: AppEventRegistry = {
    on: () => () => undefined,
    emit: () => undefined,
    off: () => false,
    clear: () => undefined,
    size: () => 0,
  };
  const observerRegistry: AppObserverRegistry = {
    observe: () => ({ disconnect: () => undefined } as unknown as MutationObserver),
    disconnect: () => false,
    disconnectAll: () => undefined,
    size: () => 0,
  };

  return {
    config: createAppConfig({
      appName: "browser-headless-debug-dump",
      prefixId: "browser-headless-debug-dump",
      debugMode: true,
      shouldUseDebugLog: true,
    }),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: false, generation: 0 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false }) },
      info: { get: () => ({
        title: null,
        author: null,
        thumbnail: null,
        pageGeneration: 0,
        infoGeneration: 0,
      }) },
    },
    elementResolver: {
      resolve: () => null,
      peek: () => null,
      invalidate: () => undefined,
      invalidateAll: () => undefined,
    },
    httpClient: {
      client: {} as never,
      request: () => { throw new Error("unused"); },
      get: () => { throw new Error("unused"); },
      post: () => { throw new Error("unused"); },
      put: () => { throw new Error("unused"); },
      patch: () => { throw new Error("unused"); },
      delete: () => { throw new Error("unused"); },
      head: () => { throw new Error("unused"); },
      clearCache: () => undefined,
      clearInFlight: () => undefined,
    },
  };
};

// browser上でdebug dump triggerが動作することを検証する関数
const runTest = (): HeadlessBridgeDetails => {
  const context = createContext();
  const baseRegistry = createDebugDumpRegistry(context);
  context.debugDumpRegistry = baseRegistry;
  baseRegistry.registerAppContext();

  let collectCount = 0;
  const requestEventName = createDebugDumpRequestEventName(context.config.prefixId);
  const uninstall = installDebugDumpTrigger({
    prefixId: context.config.prefixId,
    collectSources: () => {
      collectCount += 1;
      return baseRegistry.collect();
    },
  });

  globalThis.dispatchEvent(new CustomEvent(requestEventName));
  const collectCountAfterFirstDispatch = collectCount;

  uninstall();
  globalThis.dispatchEvent(new CustomEvent(requestEventName));

  return {
    firstDispatchCollects: collectCountAfterFirstDispatch === 1,
    uninstallStopsFurtherDispatch: collectCount === collectCountAfterFirstDispatch,
  };
};

// エクスポート
export { runTest };
