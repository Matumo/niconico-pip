/**
 * URL変更監視アダプターテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createUrlChangeObserver, type UrlCheckTrigger } from "@main/adapter/dom/url-change-observer";
import type { AppObserverRegistry } from "@main/types/app-context";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

// テスト中に差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = [
  "addEventListener",
  "removeEventListener",
  "history",
  "document",
] as const;

// オブザーバーレジストリのテストダブルを作る関数
const createObserverRegistryMock = () => {
  let mutationCallback: MutationCallback | null = null;

  const observe = vi.fn(
    (params: {
      key: string;
      target: Node;
      callback: MutationCallback;
      options: MutationObserverInit;
    }) => {
      mutationCallback = params.callback;
      return {
        disconnect: () => undefined,
        observe: () => undefined,
        takeRecords: () => [],
      } as MutationObserver;
    },
  );
  const disconnect = vi.fn(() => {
    mutationCallback = null;
    return true;
  });

  const observerRegistry = {
    observe,
    disconnect,
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  } as AppObserverRegistry;

  return {
    observerRegistry,
    observe,
    disconnect,
    triggerMutation: () => mutationCallback?.([], {} as MutationObserver),
    getMutationCallback: () => mutationCallback,
  };
};

// popstate監視のテストダブルを作る関数
const createPopStateEventApiMock = () => {
  let popStateListener: EventListenerOrEventListenerObject | undefined;

  const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === "popstate") {
      popStateListener = listener;
    }
  });
  const removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === "popstate" && popStateListener === listener) {
      popStateListener = undefined;
    }
  });

  const dispatchPopState = (): void => {
    if (!popStateListener) return;
    const popStateEvent = new Event("popstate");
    if (typeof popStateListener === "function") {
      popStateListener(popStateEvent);
    } else {
      popStateListener.handleEvent(popStateEvent);
    }
  };

  return {
    addEventListener,
    removeEventListener,
    dispatchPopState,
    getPopStateListener: () => popStateListener,
  };
};

describe("URL変更監視アダプター", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("既定設定ではinitial-startとmutation-observerのみ通知すること", () => {
    const triggers: UrlCheckTrigger[] = [];
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const documentHead = { nodeType: 1 } as Node;

    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);
    setGlobalProperty("history", { pushState, replaceState });
    setGlobalProperty("document", { head: documentHead });

    const { observerRegistry, observe, disconnect, getMutationCallback } = createObserverRegistryMock();
    const urlChangeObserver = createUrlChangeObserver({
      observerRegistry,
      onUrlCheckRequested: (trigger) => {
        triggers.push(trigger);
      },
    });

    urlChangeObserver.start();

    expect(triggers).toEqual(["initial-start"]);
    expect(addEventListener).not.toHaveBeenCalled();
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith({
      key: "page:url-change-observer",
      target: documentHead,
      callback: expect.any(Function),
      options: { childList: true, attributes: true },
    });

    pushState();
    replaceState();
    expect(triggers).toEqual(["initial-start"]);

    const mutationCallback = getMutationCallback();
    mutationCallback?.([], {} as MutationObserver);
    expect(triggers).toEqual(["initial-start", "mutation-observer"]);

    urlChangeObserver.stop();

    expect(removeEventListener).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith("page:url-change-observer");
  });

  test("start引数でpopstate/historyトリガーを有効化できること", () => {
    const triggers: UrlCheckTrigger[] = [];
    let popStateListener: EventListenerOrEventListenerObject | undefined;
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "popstate") {
        popStateListener = listener;
      }
    });
    const removeEventListener = vi.fn();
    const pushStateBase = vi.fn();
    const replaceStateBase = vi.fn();

    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);
    setGlobalProperty(
      "history",
      {
        pushState: (..._: unknown[]) => {
          pushStateBase();
        },
        replaceState: (..._: unknown[]) => {
          replaceStateBase();
        },
      },
    );
    setGlobalProperty("document", { head: { nodeType: 1 } });

    const { observerRegistry, disconnect } = createObserverRegistryMock();
    const urlChangeObserver = createUrlChangeObserver({
      observerRegistry,
      onUrlCheckRequested: (trigger) => {
        triggers.push(trigger);
      },
    });

    urlChangeObserver.start({
      usePopStateTrigger: true,
      useHistoryStateTrigger: true,
    });

    expect(triggers).toEqual(["initial-start"]);
    expect(addEventListener).toHaveBeenCalledWith("popstate", expect.any(Function));

    if (typeof popStateListener === "function") {
      popStateListener(new Event("popstate"));
    } else {
      popStateListener?.handleEvent(new Event("popstate"));
    }

    const history = (globalThis as { history: History }).history;
    history.pushState(null, "", "/watch/sm9");
    history.replaceState(null, "", "/watch/sm10");

    expect(triggers).toEqual([
      "initial-start",
      "popstate",
      "history.pushState",
      "history.replaceState",
    ]);
    expect(pushStateBase).toHaveBeenCalledTimes(1);
    expect(replaceStateBase).toHaveBeenCalledTimes(1);

    urlChangeObserver.stop();

    expect(removeEventListener).toHaveBeenCalledWith("popstate", popStateListener);
    expect(disconnect).toHaveBeenCalledWith("page:url-change-observer");
  });

  test("start前はinitial-startを除く全トリガーが発火しないこと", () => {
    const triggers: UrlCheckTrigger[] = [];
    const popStateEventApi = createPopStateEventApiMock();
    const pushStateBase = vi.fn();
    const replaceStateBase = vi.fn();

    setGlobalProperty("addEventListener", popStateEventApi.addEventListener);
    setGlobalProperty("removeEventListener", popStateEventApi.removeEventListener);
    setGlobalProperty(
      "history",
      {
        pushState: (..._: unknown[]) => {
          pushStateBase();
        },
        replaceState: (..._: unknown[]) => {
          replaceStateBase();
        },
      },
    );
    setGlobalProperty("document", { head: { nodeType: 1 } });

    const { observerRegistry, observe, triggerMutation } = createObserverRegistryMock();
    const urlChangeObserver = createUrlChangeObserver({
      observerRegistry,
      onUrlCheckRequested: (trigger) => {
        triggers.push(trigger);
      },
    });

    const history = (globalThis as { history: History }).history;
    popStateEventApi.dispatchPopState();
    history.pushState(null, "", "/watch/sm11");
    history.replaceState(null, "", "/watch/sm12");
    triggerMutation();

    expect(urlChangeObserver).toBeDefined();
    expect(triggers).toEqual([]);
    expect(popStateEventApi.addEventListener).not.toHaveBeenCalled();
    expect(popStateEventApi.getPopStateListener()).toBeUndefined();
    expect(observe).not.toHaveBeenCalled();
    expect(pushStateBase).toHaveBeenCalledTimes(1);
    expect(replaceStateBase).toHaveBeenCalledTimes(1);
  });

  test("stop後はinitial-startを除く全トリガーが発火しないこと", () => {
    const triggers: UrlCheckTrigger[] = [];
    const popStateEventApi = createPopStateEventApiMock();
    const pushStateBase = vi.fn();
    const replaceStateBase = vi.fn();

    setGlobalProperty("addEventListener", popStateEventApi.addEventListener);
    setGlobalProperty("removeEventListener", popStateEventApi.removeEventListener);
    setGlobalProperty(
      "history",
      {
        pushState: (..._: unknown[]) => {
          pushStateBase();
        },
        replaceState: (..._: unknown[]) => {
          replaceStateBase();
        },
      },
    );
    setGlobalProperty("document", { head: { nodeType: 1 } });

    const { observerRegistry, disconnect, triggerMutation } = createObserverRegistryMock();
    const urlChangeObserver = createUrlChangeObserver({
      observerRegistry,
      onUrlCheckRequested: (trigger) => {
        triggers.push(trigger);
      },
    });

    urlChangeObserver.start({
      usePopStateTrigger: true,
      useHistoryStateTrigger: true,
    });

    const history = (globalThis as { history: History }).history;
    popStateEventApi.dispatchPopState();
    history.pushState(null, "", "/watch/sm13");
    history.replaceState(null, "", "/watch/sm14");
    triggerMutation();

    expect(triggers).toEqual([
      "initial-start",
      "popstate",
      "history.pushState",
      "history.replaceState",
      "mutation-observer",
    ]);
    expect(pushStateBase).toHaveBeenCalledTimes(1);
    expect(replaceStateBase).toHaveBeenCalledTimes(1);

    const triggerCountAfterStart = triggers.length;

    urlChangeObserver.stop();

    expect(popStateEventApi.removeEventListener).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(disconnect).toHaveBeenCalledWith("page:url-change-observer");

    popStateEventApi.dispatchPopState();
    history.pushState(null, "", "/watch/sm15");
    history.replaceState(null, "", "/watch/sm16");
    triggerMutation();

    expect(triggers).toHaveLength(triggerCountAfterStart);
    expect(pushStateBase).toHaveBeenCalledTimes(2);
    expect(replaceStateBase).toHaveBeenCalledTimes(2);
  });

  test("二重start/stop時に重複登録や二重解除を行わないこと", () => {
    const triggers: UrlCheckTrigger[] = [];
    const observe = vi.fn(() => ({}) as MutationObserver);
    const disconnect = vi.fn(() => true);

    setGlobalProperty("addEventListener", undefined);
    setGlobalProperty("removeEventListener", undefined);
    setGlobalProperty("history", {});
    setGlobalProperty("document", { head: {} });

    const observerRegistry = {
      observe,
      disconnect,
      disconnectAll: vi.fn(),
      size: vi.fn(() => 0),
    } as AppObserverRegistry;

    const urlChangeObserver = createUrlChangeObserver({
      observerRegistry,
      onUrlCheckRequested: (trigger) => {
        triggers.push(trigger);
      },
    });

    urlChangeObserver.start({
      usePopStateTrigger: true,
      useHistoryStateTrigger: true,
    });
    urlChangeObserver.start({
      usePopStateTrigger: true,
      useHistoryStateTrigger: true,
    });

    expect(triggers).toEqual(["initial-start"]);
    expect(observe).not.toHaveBeenCalled();

    urlChangeObserver.stop();
    urlChangeObserver.stop();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith("page:url-change-observer");
  });
});
