/**
 * 動画要素監視アダプターテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppObserverRegistry } from "@main/types/app-context";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

let createVideoElementObserver: typeof import("@main/adapter/dom/video-element-observer").createVideoElementObserver;
let loggerMockHarness: TsSimpleLoggerMockHarness;

// テストで差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["document", "HTMLElement"] as const;
const discoverObserverKey = "elements:discover-player-observer";
const playerObserverKey = "elements:watch-player-observer";

// オブザーバーレジストリのテストダブルを作る関数
const createObserverRegistryMock = () => {
  type ObserveParams = {
    key: string;
    target: Node;
    callback: MutationCallback;
    options: MutationObserverInit;
  };

  const observeParamsMap = new Map<string, ObserveParams>();
  const observe = vi.fn((params: ObserveParams) => {
    observeParamsMap.set(params.key, params);
    return {
      disconnect: () => undefined,
      observe: () => undefined,
      takeRecords: () => [],
    } as MutationObserver;
  });
  const disconnect = vi.fn((key: string) => {
    observeParamsMap.delete(key);
    return true;
  });

  const observerRegistry = {
    observe,
    disconnect,
    disconnectAll: vi.fn(),
    size: vi.fn(() => observeParamsMap.size),
  } as AppObserverRegistry;

  const invokeMutation = (key: string, mutations: MutationRecord[]): void => {
    const params = observeParamsMap.get(key);
    if (!params) throw new Error(`observer callback not found: ${key}`);
    params.callback(mutations, {} as MutationObserver);
  };

  return {
    observerRegistry,
    observe,
    disconnect,
    observeParamsMap,
    invokeMutation,
  };
};

// MutationRecordの最小テストデータを作る関数
const createMutationRecord = (partial: Partial<MutationRecord>): MutationRecord => ({
  type: "childList",
  target: {} as Node,
  addedNodes: [] as unknown as NodeList,
  removedNodes: [] as unknown as NodeList,
  previousSibling: null,
  nextSibling: null,
  attributeName: null,
  attributeNamespace: null,
  oldValue: null,
  ...partial,
});

describe("動画要素監視アダプター", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createVideoElementObserver } = await import("@main/adapter/dom/video-element-observer"));

    loggerMockHarness.clearLoggerCalls();
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("startでdiscover監視を開始しinitial-startを通知すること", () => {
    const discoverTriggers: string[] = [];
    const playerTriggers: string[] = [];
    const documentNode = { nodeType: 9 } as Node;
    const {
      observerRegistry,
      observe,
      observeParamsMap,
      invokeMutation,
    } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: (trigger) => {
        discoverTriggers.push(trigger);
      },
      onPlayerCheckRequested: (trigger) => {
        playerTriggers.push(trigger);
      },
    });

    observer.start();

    expect(discoverTriggers).toEqual(["initial-start"]);
    expect(playerTriggers).toEqual([]);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observeParamsMap.get(discoverObserverKey)).toMatchObject({
      key: discoverObserverKey,
      target: documentNode,
      options: {
        subtree: true,
        childList: true,
        attributes: false,
      },
    });

    // childList変化は再評価トリガーを通知する
    invokeMutation(discoverObserverKey, [
      createMutationRecord({
        type: "childList",
        addedNodes: [{ nodeType: 1 } as Node] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      }),
    ]);
    expect(discoverTriggers).toEqual(["initial-start", "discover-mutation"]);
  });

  test("discover監視対象はbody > #root mainを優先して絞ること", () => {
    const appMainNode = { nodeType: 1 } as Node;
    const documentBodyNode = { nodeType: 1 } as Node;
    const querySelector = vi.fn(() => appMainNode as unknown as Element);
    const documentNode = {
      nodeType: 9,
      body: documentBodyNode,
      querySelector,
    } as unknown as Node;
    const {
      observerRegistry,
      observeParamsMap,
    } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: () => undefined,
      onPlayerCheckRequested: () => undefined,
    });

    observer.start();

    expect(observeParamsMap.get(discoverObserverKey)).toMatchObject({
      key: discoverObserverKey,
      target: appMainNode,
      options: {
        subtree: true,
        childList: true,
        attributes: false,
      },
    });
    expect(querySelector).toHaveBeenCalledWith("body > #root main");
  });

  test("discover監視対象はmainがない場合にbody > #rootへフォールバックすること", () => {
    const appRootNode = { nodeType: 1 } as Node;
    const documentBodyNode = { nodeType: 1 } as Node;
    const querySelector = vi.fn((selector: string) => {
      if (selector === "body > #root main") return null;
      if (selector === "body > #root") return appRootNode as unknown as Element;
      return null;
    });
    const documentNode = {
      nodeType: 9,
      body: documentBodyNode,
      querySelector,
    } as unknown as Node;
    const { observerRegistry, observeParamsMap } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: () => undefined,
      onPlayerCheckRequested: () => undefined,
    });

    observer.start();

    expect(observeParamsMap.get(discoverObserverKey)).toMatchObject({
      key: discoverObserverKey,
      target: appRootNode,
      options: {
        subtree: true,
        childList: true,
        attributes: false,
      },
    });
    expect(querySelector).toHaveBeenNthCalledWith(1, "body > #root main");
    expect(querySelector).toHaveBeenNthCalledWith(2, "body > #root");
  });

  test("discover監視対象はrootがない場合にbodyへフォールバックすること", () => {
    const bodyNode = { nodeType: 1 } as Node;
    const querySelector = vi.fn((selector: string) => {
      if (selector === "body") return bodyNode as unknown as Element;
      return null;
    });
    const documentNode = {
      nodeType: 9,
      querySelector,
    } as unknown as Node;
    const { observerRegistry, observeParamsMap } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: () => undefined,
      onPlayerCheckRequested: () => undefined,
    });

    observer.start();

    expect(observeParamsMap.get(discoverObserverKey)).toMatchObject({
      key: discoverObserverKey,
      target: bodyNode,
      options: {
        subtree: true,
        childList: true,
        attributes: false,
      },
    });
    expect(querySelector).toHaveBeenNthCalledWith(1, "body > #root main");
    expect(querySelector).toHaveBeenNthCalledWith(2, "body > #root");
    expect(querySelector).toHaveBeenNthCalledWith(3, "body");
  });

  test("discover監視対象は候補不一致時にdocumentへフォールバックすること", () => {
    const querySelector = vi.fn(() => null as Element | null);
    const documentNode = {
      nodeType: 9,
      querySelector,
    } as unknown as Node;
    const { observerRegistry, observeParamsMap } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: () => undefined,
      onPlayerCheckRequested: () => undefined,
    });

    observer.start();

    expect(observeParamsMap.get(discoverObserverKey)).toMatchObject({
      key: discoverObserverKey,
      target: documentNode,
      options: {
        subtree: true,
        childList: true,
        attributes: false,
      },
    });
    expect(querySelector).toHaveBeenNthCalledWith(1, "body > #root main");
    expect(querySelector).toHaveBeenNthCalledWith(2, "body > #root");
    expect(querySelector).toHaveBeenNthCalledWith(3, "body");
  });

  test("switchToPlayerでplayer監視へ切り替え、player-mutationを通知すること", () => {
    const discoverTriggers: string[] = [];
    const playerTriggers: string[] = [];
    const documentNode = { nodeType: 9 } as Node;
    const playerNode = { nodeType: 1 } as Node;
    const {
      observerRegistry,
      observeParamsMap,
      disconnect,
      invokeMutation,
    } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: (trigger) => {
        discoverTriggers.push(trigger);
      },
      onPlayerCheckRequested: (trigger) => {
        playerTriggers.push(trigger);
      },
    });

    observer.start();
    observer.switchToPlayer(playerNode);

    expect(disconnect).toHaveBeenCalledWith(discoverObserverKey);
    expect(observeParamsMap.get(playerObserverKey)).toMatchObject({
      key: playerObserverKey,
      target: playerNode,
      options: {
        subtree: false,
        childList: true,
        attributes: false,
      },
    });

    // childList変化は再評価トリガーを通知する
    invokeMutation(playerObserverKey, [
      createMutationRecord({
        type: "childList",
        addedNodes: [{ nodeType: 1 } as Node] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      }),
    ]);
    expect(discoverTriggers).toEqual(["initial-start"]);
    expect(playerTriggers).toEqual(["player-mutation"]);
  });

  test("シークバー関連Mutationはdiscover/playerともにスキップすること", () => {
    const discoverTriggers: string[] = [];
    const playerTriggers: string[] = [];
    const documentNode = { nodeType: 9 } as Node;
    const playerNode = { nodeType: 1 } as Node;
    const {
      observerRegistry,
      invokeMutation,
    } = createObserverRegistryMock();

    setGlobalProperty("document", documentNode);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: (trigger) => {
        discoverTriggers.push(trigger);
      },
      onPlayerCheckRequested: (trigger) => {
        playerTriggers.push(trigger);
      },
    });

    observer.start();

    // style属性変化（attributes）はシークバー想定でスキップされる
    invokeMutation(discoverObserverKey, [
      createMutationRecord({
        type: "attributes",
        attributeName: "style",
      }),
    ]);
    expect(discoverTriggers).toEqual(["initial-start"]);

    observer.switchToPlayer(playerNode);

    // spanターゲットの入れ替えMutationはシークバーカーソル扱いでスキップされる
    class FakeHTMLElement {
      public readonly tagName: string;
      public constructor(tagName: string) {
        this.tagName = tagName;
      }
    }
    setGlobalProperty("HTMLElement", FakeHTMLElement as unknown as typeof HTMLElement);
    const spanTarget = new FakeHTMLElement("SPAN");

    invokeMutation(playerObserverKey, [
      createMutationRecord({
        type: "childList",
        addedNodes: [{ nodeType: 1 } as Node] as unknown as NodeList,
        removedNodes: [{ nodeType: 1 } as Node] as unknown as NodeList,
        target: spanTarget as unknown as Node,
      }),
    ]);
    expect(playerTriggers).toEqual([]);
  });

  test("documentが未利用時はdiscover監視登録をスキップしてinitial-startのみ通知すること", () => {
    const discoverTriggers: string[] = [];
    const { observerRegistry, observe } = createObserverRegistryMock();

    setGlobalProperty("document", undefined);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: (trigger) => {
        discoverTriggers.push(trigger);
      },
      onPlayerCheckRequested: () => undefined,
    });

    observer.start();

    expect(discoverTriggers).toEqual(["initial-start"]);
    expect(observe).not.toHaveBeenCalled();
  });

  test("start前とstop後はswitchToDiscover/switchToPlayerが何もしないこと", () => {
    const { observerRegistry, observe, disconnect } = createObserverRegistryMock();
    const playerNode = { nodeType: 1 } as Node;
    setGlobalProperty("document", { nodeType: 9 } as Node);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: () => undefined,
      onPlayerCheckRequested: () => undefined,
    });

    observer.switchToDiscover();
    observer.switchToPlayer(playerNode);
    expect(observe).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();

    observer.start();
    observer.stop();
    observe.mockClear();
    disconnect.mockClear();

    observer.switchToDiscover();
    observer.switchToPlayer(playerNode);
    expect(observe).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  test("start/stopの二重呼び出しを無視すること", () => {
    const discoverTriggers: string[] = [];
    const { observerRegistry, observe, disconnect } = createObserverRegistryMock();

    setGlobalProperty("document", { nodeType: 9 } as Node);

    const observer = createVideoElementObserver({
      observerRegistry,
      onDiscoverCheckRequested: (trigger) => {
        discoverTriggers.push(trigger);
      },
      onPlayerCheckRequested: () => undefined,
    });

    observer.stop(); // start前のstopは無視
    observer.start();
    observer.start(); // 二重startは無視
    observer.stop();
    observer.stop(); // 二重stopは無視

    expect(discoverTriggers).toEqual(["initial-start"]);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(disconnect.mock.calls.map((args) => args[0])).toEqual([
      playerObserverKey,
      discoverObserverKey,
      playerObserverKey,
    ]);
  });
});
