/**
 * 動画要素監視アダプターのランタイムテスト
 */
import {
  createVideoElementObserver,
  type VideoElementObserverTrigger,
} from "@main/adapter/dom/video-element-observer";
import type { AppObserverRegistry } from "@main/types/app-context";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

interface ObserverRegistryDouble {
  observerRegistry: AppObserverRegistry;
  hasObserver(key: string): boolean;
  triggerMutation(key: string, mutations: MutationRecord[]): boolean;
  getObserveCount(key: string): number;
  getDisconnectCount(key: string): number;
}

const discoverObserverKey = "elements:discover-player-observer";
const playerObserverKey = "elements:watch-player-observer";

const createObserverRegistryDouble = (): ObserverRegistryDouble => {
  const callbackMap = new Map<string, MutationCallback>();
  const observeCountMap = new Map<string, number>();
  const disconnectCountMap = new Map<string, number>();

  const incrementCount = (countMap: Map<string, number>, key: string): void => {
    const count = countMap.get(key) ?? 0;
    countMap.set(key, count + 1);
  };

  const observerRegistry: AppObserverRegistry = {
    observe: (params) => {
      incrementCount(observeCountMap, params.key);
      callbackMap.set(params.key, params.callback);
      return new MutationObserver(() => undefined);
    },
    disconnect: (key) => {
      incrementCount(disconnectCountMap, key);
      callbackMap.delete(key);
      return true;
    },
    disconnectAll: () => {
      for (const key of callbackMap.keys()) {
        incrementCount(disconnectCountMap, key);
      }
      callbackMap.clear();
    },
    size: () => callbackMap.size,
  };

  return {
    observerRegistry,
    hasObserver: (key) => callbackMap.has(key),
    triggerMutation: (key, mutations) => {
      const callback = callbackMap.get(key);
      if (!callback) return false;
      callback(mutations, new MutationObserver(() => undefined));
      return true;
    },
    getObserveCount: (key) => observeCountMap.get(key) ?? 0,
    getDisconnectCount: (key) => disconnectCountMap.get(key) ?? 0,
  };
};

const createMutationRecord = (partial: Partial<MutationRecord>): MutationRecord => ({
  type: "childList",
  target: globalThis.document.body,
  addedNodes: [] as unknown as NodeList,
  removedNodes: [] as unknown as NodeList,
  previousSibling: null,
  nextSibling: null,
  attributeName: null,
  attributeNamespace: null,
  oldValue: null,
  ...partial,
});

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const observerRegistryDouble = createObserverRegistryDouble();
  const discoverTriggers: VideoElementObserverTrigger[] = [];
  const playerTriggers: VideoElementObserverTrigger[] = [];

  const observer = createVideoElementObserver({
    observerRegistry: observerRegistryDouble.observerRegistry,
    onDiscoverCheckRequested: (trigger) => {
      discoverTriggers.push(trigger);
    },
    onPlayerCheckRequested: (trigger) => {
      playerTriggers.push(trigger);
    },
  });

  const playerNode = globalThis.document.createElement("div");

  // start前はswitchが何もしないことを確認する処理
  observer.switchToDiscover();
  observer.switchToPlayer(playerNode);
  const switchIgnoredBeforeStart =
    observerRegistryDouble.getObserveCount(discoverObserverKey) === 0 &&
    observerRegistryDouble.getObserveCount(playerObserverKey) === 0 &&
    observerRegistryDouble.getDisconnectCount(discoverObserverKey) === 0 &&
    observerRegistryDouble.getDisconnectCount(playerObserverKey) === 0;

  // discover開始と初回通知を確認する処理
  observer.start();
  const startInitialStartEmitted = discoverTriggers[0] === "initial-start";
  const discoverObserverRegisteredOnStart =
    observerRegistryDouble.hasObserver(discoverObserverKey) &&
    !observerRegistryDouble.hasObserver(playerObserverKey) &&
    observerRegistryDouble.getObserveCount(discoverObserverKey) === 1;

  const discoverMutationTriggered = observerRegistryDouble.triggerMutation(discoverObserverKey, [
    createMutationRecord({
      type: "childList",
      addedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
    }),
  ]);
  const discoverMutationEmitted =
    discoverMutationTriggered && discoverTriggers.includes("discover-mutation");

  // player監視へ切り替えできることを確認する処理
  observer.switchToPlayer(playerNode);
  const playerObserverRegisteredOnSwitch =
    observerRegistryDouble.getDisconnectCount(discoverObserverKey) >= 1 &&
    observerRegistryDouble.hasObserver(playerObserverKey) &&
    observerRegistryDouble.getObserveCount(playerObserverKey) === 1;

  const playerMutationTriggered = observerRegistryDouble.triggerMutation(playerObserverKey, [
    createMutationRecord({
      type: "childList",
      target: playerNode,
      addedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
    }),
  ]);
  const playerMutationEmitted = playerMutationTriggered && playerTriggers.includes("player-mutation");

  // シークバー想定mutationがスキップされることを確認する処理
  observer.switchToDiscover();
  const discoverCountBeforeSkip = discoverTriggers.length;
  const discoverSkipMutationTriggered = observerRegistryDouble.triggerMutation(discoverObserverKey, [
    createMutationRecord({
      type: "attributes",
      attributeName: "style",
      target: playerNode,
    }),
  ]);
  const discoverSkipWorked =
    discoverSkipMutationTriggered && discoverTriggers.length === discoverCountBeforeSkip;

  observer.switchToPlayer(playerNode);
  const playerCountBeforeSkip = playerTriggers.length;
  const playerSkipMutationTriggered = observerRegistryDouble.triggerMutation(playerObserverKey, [
    createMutationRecord({
      type: "childList",
      target: globalThis.document.createElement("span"),
      addedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
      removedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
    }),
  ]);
  const playerSkipWorked =
    playerSkipMutationTriggered && playerTriggers.length === playerCountBeforeSkip;

  // stop後は監視解除されることを確認する処理
  observer.stop();
  const observersClearedOnStop =
    !observerRegistryDouble.hasObserver(discoverObserverKey) &&
    !observerRegistryDouble.hasObserver(playerObserverKey) &&
    observerRegistryDouble.getDisconnectCount(discoverObserverKey) >= 1 &&
    observerRegistryDouble.getDisconnectCount(playerObserverKey) >= 1;

  const discoverCountBeforeStopTrigger = discoverTriggers.length;
  const playerCountBeforeStopTrigger = playerTriggers.length;
  const stopIgnoredDiscoverMutation = !observerRegistryDouble.triggerMutation(discoverObserverKey, [
    createMutationRecord({
      type: "childList",
      target: playerNode,
      addedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
    }),
  ]);
  const stopIgnoredPlayerMutation = !observerRegistryDouble.triggerMutation(playerObserverKey, [
    createMutationRecord({
      type: "childList",
      target: playerNode,
      addedNodes: [globalThis.document.createElement("div")] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
    }),
  ]);

  const noTriggerAfterStop =
    stopIgnoredDiscoverMutation &&
    stopIgnoredPlayerMutation &&
    discoverTriggers.length === discoverCountBeforeStopTrigger &&
    playerTriggers.length === playerCountBeforeStopTrigger;

  return {
    switchIgnoredBeforeStart,
    startInitialStartEmitted,
    discoverObserverRegisteredOnStart,
    discoverMutationEmitted,
    playerObserverRegisteredOnSwitch,
    playerMutationEmitted,
    discoverSkipWorked,
    playerSkipWorked,
    observersClearedOnStop,
    noTriggerAfterStop,
  };
};

// エクスポート
export { runTest };
