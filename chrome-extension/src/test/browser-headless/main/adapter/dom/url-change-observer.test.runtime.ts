/**
 * URL変更監視アダプターのランタイムテスト
 */
import {
  createUrlChangeObserver,
  type UrlCheckTrigger,
} from "@main/adapter/dom/url-change-observer";
import type { AppObserverRegistry } from "@main/types/app-context";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// オブザーバーレジストリのテストダブルインターフェース
interface ObserverRegistryDouble {
  observerRegistry: AppObserverRegistry;
  triggerMutationObserver: () => void;
  getObserveCount: () => number;
  getDisconnectCount: () => number;
}

// オブザーバーレジストリのテストダブルを作る関数
const createObserverRegistryDouble = (): ObserverRegistryDouble => {
  let observeCount = 0;
  let disconnectCount = 0;
  let callback: MutationCallback | null = null;

  const observerRegistry: AppObserverRegistry = {
    observe: (params) => {
      observeCount += 1;
      callback = params.callback;
      return new MutationObserver(() => undefined);
    },
    disconnect: () => {
      disconnectCount += 1;
      callback = null;
      return true;
    },
    disconnectAll: () => undefined,
    size: () => 0,
  };

  return {
    observerRegistry,
    triggerMutationObserver: () => {
      callback?.([], new MutationObserver(() => undefined));
    },
    getObserveCount: () => observeCount,
    getDisconnectCount: () => disconnectCount,
  };
};

// URL変更監視の既定挙動と有効化挙動を検証する関数
const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const triggersOnDefault: UrlCheckTrigger[] = [];
  const triggersOnEnabled: UrlCheckTrigger[] = [];
  const initialUrl = globalThis.location.href;
  const nextUrl = new URL(`/watch/url-observer-${Date.now()}`, globalThis.location.origin).toString();

  const defaultRegistryDouble = createObserverRegistryDouble();
  const enabledRegistryDouble = createObserverRegistryDouble();

  const defaultObserver = createUrlChangeObserver({
    observerRegistry: defaultRegistryDouble.observerRegistry,
    onUrlCheckRequested: (trigger) => {
      triggersOnDefault.push(trigger);
    },
  });
  const enabledObserver = createUrlChangeObserver({
    observerRegistry: enabledRegistryDouble.observerRegistry,
    onUrlCheckRequested: (trigger) => {
      triggersOnEnabled.push(trigger);
    },
  });

  try {
    // 既定設定ではinitial-startのみ発火することを確認する処理
    defaultObserver.start();
    const defaultCountBeforeActions = triggersOnDefault.length;

    globalThis.history.pushState({ runtimeTest: "default" }, "", nextUrl);
    globalThis.history.replaceState({ runtimeTest: "default-replace" }, "", nextUrl);
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    await Promise.resolve();

    const defaultCountAfterActions = triggersOnDefault.length;
    defaultRegistryDouble.triggerMutationObserver();

    // 既定設定でstop後は追加発火しないことを確認する処理
    const defaultCountBeforeStop = triggersOnDefault.length;
    defaultObserver.stop();
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    globalThis.history.pushState({ runtimeTest: "default-after-stop" }, "", nextUrl);
    globalThis.history.replaceState({ runtimeTest: "default-after-stop-replace" }, "", nextUrl);
    defaultRegistryDouble.triggerMutationObserver();
    await Promise.resolve();
    const defaultCountAfterStop = triggersOnDefault.length;

    // オプション有効化時は各トリガーが発火することを確認する処理
    enabledObserver.start({
      usePopStateTrigger: true,
      useHistoryStateTrigger: true,
    });
    const enabledCountBeforeActions = triggersOnEnabled.length;

    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    globalThis.history.pushState({ runtimeTest: "enabled" }, "", nextUrl);
    globalThis.history.replaceState({ runtimeTest: "enabled-replace" }, "", nextUrl);
    enabledRegistryDouble.triggerMutationObserver();
    await Promise.resolve();
    const enabledCountAfterActions = triggersOnEnabled.length;

    // オプション有効化時もstop後は追加発火しないことを確認する処理
    const enabledCountBeforeStop = triggersOnEnabled.length;
    enabledObserver.stop();
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    globalThis.history.pushState({ runtimeTest: "enabled-after-stop" }, "", nextUrl);
    globalThis.history.replaceState({ runtimeTest: "enabled-after-stop-replace" }, "", nextUrl);
    enabledRegistryDouble.triggerMutationObserver();
    await Promise.resolve();
    const enabledCountAfterStop = triggersOnEnabled.length;

    return {
      defaultInitialStartOnly:
        triggersOnDefault[0] === "initial-start" &&
        defaultCountBeforeActions === 1,
      defaultHistoryPushStateDisabled:
        !triggersOnDefault.includes("history.pushState") &&
        defaultCountAfterActions === defaultCountBeforeActions,
      defaultHistoryReplaceStateDisabled: !triggersOnDefault.includes("history.replaceState"),
      defaultPopStateDisabled: !triggersOnDefault.includes("popstate"),
      defaultMutationObserverEnabled: triggersOnDefault.includes("mutation-observer"),
      defaultObserverRegistryUsed:
        defaultRegistryDouble.getObserveCount() === 1 &&
        defaultRegistryDouble.getDisconnectCount() === 1,
      defaultStopPreventsFurtherTriggers: defaultCountAfterStop === defaultCountBeforeStop,
      enabledInitialStartEmitted: triggersOnEnabled.includes("initial-start"),
      enabledPopStateTriggered: triggersOnEnabled.includes("popstate"),
      enabledHistoryPushStateTriggered: triggersOnEnabled.includes("history.pushState"),
      enabledHistoryReplaceStateTriggered: triggersOnEnabled.includes("history.replaceState"),
      enabledMutationObserverTriggered: triggersOnEnabled.includes("mutation-observer"),
      enabledObserverRegistryUsed:
        enabledRegistryDouble.getObserveCount() === 1 &&
        enabledRegistryDouble.getDisconnectCount() === 1,
      enabledStopPreventsFurtherTriggers: enabledCountAfterStop === enabledCountBeforeStop,
      enabledTriggerCountIncreased: enabledCountAfterActions > enabledCountBeforeActions,
    };
  } finally {
    // テスト後にURLを元に戻す
    globalThis.history.replaceState({ runtimeTestRestore: true }, "", initialUrl);
    await Promise.resolve();
  }
};

// エクスポート
export { runTest };
