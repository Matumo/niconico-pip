/**
 * eventレジストリのブラウザランタイムテスト
 */
import { createAppEventNameMap, type AppEventMap, type ElementsSnapshot } from "@main/config/event";
import { createAppConfig } from "@main/config/config";
import { selectorDefinitions } from "@main/config/selector";
import { createEventRegistry } from "@main/platform/event-registry";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// 空の要素スナップショットを作る関数
const createEmptyElementsSnapshot = (): ElementsSnapshot => {
  const snapshot = {} as ElementsSnapshot;
  for (const key of Object.keys(selectorDefinitions) as (keyof ElementsSnapshot)[]) {
    snapshot[key] = null;
  }
  return snapshot;
};

const runTest = (): HeadlessBridgeDetails => {
  const config = createAppConfig();
  const eventRegistry = createEventRegistry(createAppEventNameMap(config.prefixId));
  const target = new EventTarget();
  const statusPayload: AppEventMap["StatusChanged"] = { status: "ready" };
  const nullPrototypeStatusPayload = Object.assign(Object.create(null), {
    status: "ready" as const,
  }) as AppEventMap["StatusChanged"];
  const originalPagePayload: AppEventMap["PageUrlChanged"] = {
    url: "https://example.test/watch/sm9",
    generation: 1,
    isWatchPage: true,
    changedKeys: ["url"] as const,
  };
  const originalElementsSnapshot = createEmptyElementsSnapshot();
  const originalElementsPayload: AppEventMap["ElementsUpdated"] = {
    pageGeneration: 1,
    elementsGeneration: 1,
    changedKeys: ["video"] as const,
    snapshot: originalElementsSnapshot,
  };

  let statusListenerReceivedReady = false;
  let duplicateFirstCalled = false;
  let duplicateSecondCalled = false;
  let unsubscribeCalled = false;
  let reAddFirstCalled = false;
  let reAddSecondCalled = false;
  let pagePayloadReceived = false;
  let pagePayloadCloned = false;
  let pagePayloadFrozen = false;
  let pageChangedKeysCloned = false;
  let pageChangedKeysFrozen = false;
  let topLevelMutationRejected = false;
  let changedKeysMutationRejected = false;
  let pageSecondListenerSawOriginalUrl = false;
  let elementsPayloadSnapshot: AppEventMap["ElementsUpdated"]["snapshot"] | null = null;
  let snapshotMutationRejected = false;
  let nullPrototypePayloadCloned = false;
  let nullPrototypePayloadFrozen = false;
  let nullPrototypePayloadPreserved = false;

  eventRegistry.on({
    target,
    key: "status-typed",
    eventKey: "StatusChanged",
    listener: (payload) => {
      statusListenerReceivedReady = payload.status === "ready";
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    payload: statusPayload,
  });

  eventRegistry.on({
    target,
    key: "duplicate",
    eventKey: "VideoTimeChanged",
    listener: () => {
      duplicateFirstCalled = true;
    },
  });
  eventRegistry.on({
    target,
    key: "duplicate",
    eventKey: "VideoTimeChanged",
    listener: () => {
      duplicateSecondCalled = true;
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "VideoTimeChanged",
    payload: { currentTime: 10, duration: 30 },
  });

  const unsubscribe = eventRegistry.on({
    target,
    key: "unsubscribe",
    eventKey: "VideoInfoChanged",
    listener: () => {
      unsubscribeCalled = true;
    },
  });
  unsubscribe();
  eventRegistry.emit({
    target,
    eventKey: "VideoInfoChanged",
    payload: {
      title: "title",
      author: "author",
      thumbnail: "https://example.test/thumb.jpg",
      pageGeneration: 1,
      infoGeneration: 1,
      changedKeys: ["title", "author", "thumbnail"],
    },
  });

  eventRegistry.on({
    target,
    key: "off-a",
    eventKey: "PipStatusChanged",
    listener: () => undefined,
  });
  eventRegistry.on({
    target,
    key: "off-b",
    eventKey: "PageUrlChanged",
    listener: () => undefined,
  });
  const offRemovedExisting = eventRegistry.off("off-a");
  const offMissingReturnedFalse = eventRegistry.off("off-missing") === false;
  eventRegistry.clear();
  const clearRemovedAllListeners = eventRegistry.size() === 0;

  eventRegistry.on({
    target,
    key: "re-add",
    eventKey: "StatusChanged",
    listener: () => {
      reAddFirstCalled = true;
    },
  });
  eventRegistry.off("re-add");
  eventRegistry.on({
    target,
    key: "re-add",
    eventKey: "StatusChanged",
    listener: () => {
      reAddSecondCalled = true;
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    payload: statusPayload,
  });

  eventRegistry.on({
    target,
    key: "page-first",
    eventKey: "PageUrlChanged",
    listener: (payload) => {
      pagePayloadReceived = true;
      pagePayloadCloned = payload !== originalPagePayload;
      pagePayloadFrozen = Object.isFrozen(payload);
      pageChangedKeysCloned = payload.changedKeys !== originalPagePayload.changedKeys;
      pageChangedKeysFrozen = Object.isFrozen(payload.changedKeys);
      topLevelMutationRejected = Reflect.set(payload as Record<string, unknown>, "url", "mutated-url") === false;
      changedKeysMutationRejected = Reflect.set(
        payload.changedKeys as unknown as Record<string, unknown>,
        "0",
        "mutated-key",
      ) === false;
    },
  });
  eventRegistry.on({
    target,
    key: "page-second",
    eventKey: "PageUrlChanged",
    listener: (payload) => {
      pageSecondListenerSawOriginalUrl = payload.url === originalPagePayload.url;
    },
  });
  eventRegistry.on({
    target,
    key: "elements",
    eventKey: "ElementsUpdated",
    listener: (payload) => {
      elementsPayloadSnapshot = payload.snapshot;
      snapshotMutationRejected = Reflect.set(
        payload.snapshot as unknown as Record<string, unknown>,
        "video",
        "mutated-video",
      ) === false;
    },
  });

  eventRegistry.emit({
    target,
    eventKey: "PageUrlChanged",
    payload: originalPagePayload,
  });
  eventRegistry.emit({
    target,
    eventKey: "ElementsUpdated",
    payload: originalElementsPayload,
  });
  eventRegistry.on({
    target,
    key: "null-prototype",
    eventKey: "StatusChanged",
    listener: (payload) => {
      nullPrototypePayloadCloned = payload !== nullPrototypeStatusPayload;
      nullPrototypePayloadFrozen = Object.isFrozen(payload);
      nullPrototypePayloadPreserved = payload.status === "ready";
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    payload: nullPrototypeStatusPayload,
  });

  return {
    statusListenerReceivedReady,
    duplicateKeyOverwroteFirstListener: !duplicateFirstCalled && duplicateSecondCalled,
    unsubscribePreventedDelivery: unsubscribeCalled === false,
    offRemovedExisting,
    offMissingReturnedFalse,
    clearRemovedAllListeners,
    reAddPreventedFirstDelivery: !reAddFirstCalled,
    reAddDeliveredSecondListener: reAddSecondCalled,
    pagePayloadReceived,
    pagePayloadCloned,
    pagePayloadFrozen,
    pageChangedKeysCloned,
    pageChangedKeysFrozen,
    pageTopLevelMutationRejected: topLevelMutationRejected,
    pageChangedKeysMutationRejected: changedKeysMutationRejected,
    pageSecondListenerSawOriginalUrl,
    elementsSnapshotCloned: elementsPayloadSnapshot !== originalElementsSnapshot,
    elementsSnapshotFrozen: Object.isFrozen(elementsPayloadSnapshot),
    elementsSnapshotMutationRejected: snapshotMutationRejected,
    nullPrototypeBranchCovered: Object.getPrototypeOf(nullPrototypeStatusPayload) === null,
    nullPrototypePayloadCloned,
    nullPrototypePayloadFrozen,
    nullPrototypePayloadPreserved,
    originalPagePayloadStillMutable: Object.isFrozen(originalPagePayload) === false,
    originalPageChangedKeysStillMutable: Object.isFrozen(originalPagePayload.changedKeys) === false,
    originalElementsSnapshotStillMutable: Object.isFrozen(originalElementsSnapshot) === false,
    originalNullPrototypePayloadStillMutable: Object.isFrozen(nullPrototypeStatusPayload) === false,
  };
};

// エクスポート
export { runTest };
