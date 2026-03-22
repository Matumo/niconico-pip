/**
 * eventレジストリのブラウザランタイムテスト
 */
import { createAppEventNameMap, type AppEventMap, type ElementsSnapshot } from "@main/config/event";
import { createAppConfig } from "@main/config/config";
import { selectorDefinitions } from "@main/config/selector";
import type { DomainName } from "@main/domain/shared/domain-name";
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

const eventTestDomains = {
  page: "page",
  elements: "elements",
  status: "status",
  time: "time",
  pip: "pip",
} as const satisfies Record<string, DomainName>;

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
  const foreignRegistrationGuardTarget = new EventTarget();
  const allowedCrossDomainTarget = new EventTarget();
  const listenerOrderGuardTarget = new EventTarget();
  const ownerMismatchGuardTarget = new EventTarget();
  const differentTargetGuardTarget = new EventTarget();
  const differentTargetOtherTarget = new EventTarget();
  let rejectedForeignStatusListenerCallCount = 0;
  let acceptedOwnerStatusListenerCallCount = 0;
  let allowedCrossDomainPageListenerCallCount = 0;
  let foreignStatusRegistrationThrew = false;
  let rejectedLateElementsListenerCallCount = 0;
  let acceptedOwnerElementsListenerCallCount = 0;
  let listenerOrderRegistrationThrew = false;
  let ownerMismatchPageOwnerListenerCallCount = 0;
  let ownerMismatchPageForeignListenerCallCount = 0;
  let ownerMismatchEmitThrew = false;
  let differentTargetDeliveredCallCount = 0;
  let differentTargetIgnoredCallCount = 0;
  let differentEventIgnoredCallCount = 0;

  eventRegistry.on({
    target,
    key: "status-typed",
    eventKey: "StatusChanged",
    listenerDomain: eventTestDomains.status,
    listener: (payload) => {
      statusListenerReceivedReady = payload.status === "ready";
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    ownerDomain: eventTestDomains.status,
    payload: statusPayload,
  });

  try {
    eventRegistry.on({
      target: foreignRegistrationGuardTarget,
      key: "foreign-status-listener",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.page,
      listener: () => {
        rejectedForeignStatusListenerCallCount += 1;
      },
    });
  } catch {
    foreignStatusRegistrationThrew = true;
  }
  eventRegistry.on({
    target: foreignRegistrationGuardTarget,
    key: "owner-status-listener",
    eventKey: "StatusChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      acceptedOwnerStatusListenerCallCount += 1;
    },
  });
  eventRegistry.emit({
    target: foreignRegistrationGuardTarget,
    eventKey: "StatusChanged",
    ownerDomain: eventTestDomains.status,
    payload: statusPayload,
  });
  eventRegistry.on({
    target: allowedCrossDomainTarget,
    key: "cross-domain-allowed-foreign",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      allowedCrossDomainPageListenerCallCount += 1;
    },
  });
  eventRegistry.emit({
    target: allowedCrossDomainTarget,
    eventKey: "PageUrlChanged",
    ownerDomain: eventTestDomains.page,
    payload: originalPagePayload,
  });
  try {
    eventRegistry.on({
      target: listenerOrderGuardTarget,
      key: "late-elements-listener",
      eventKey: "ElementsUpdated",
      listenerDomain: eventTestDomains.page,
      listener: () => {
        rejectedLateElementsListenerCallCount += 1;
      },
    });
  } catch {
    listenerOrderRegistrationThrew = true;
  }
  eventRegistry.on({
    target: listenerOrderGuardTarget,
    key: "owner-elements-listener",
    eventKey: "ElementsUpdated",
    listenerDomain: eventTestDomains.elements,
    listener: () => {
      acceptedOwnerElementsListenerCallCount += 1;
    },
  });
  eventRegistry.emit({
    target: listenerOrderGuardTarget,
    eventKey: "ElementsUpdated",
    ownerDomain: eventTestDomains.elements,
    payload: originalElementsPayload,
  });
  eventRegistry.on({
    target: ownerMismatchGuardTarget,
    key: "owner-mismatch-page-owner",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.page,
    listener: () => {
      ownerMismatchPageOwnerListenerCallCount += 1;
    },
  });
  eventRegistry.on({
    target: ownerMismatchGuardTarget,
    key: "owner-mismatch-page-foreign",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      ownerMismatchPageForeignListenerCallCount += 1;
    },
  });
  try {
    eventRegistry.emit({
      target: ownerMismatchGuardTarget,
      eventKey: "PageUrlChanged",
      ownerDomain: eventTestDomains.status,
      payload: originalPagePayload,
    });
  } catch {
    ownerMismatchEmitThrew = true;
  }
  eventRegistry.on({
    target: differentTargetGuardTarget,
    key: "different-target-delivered",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.page,
    listener: () => {
      differentTargetDeliveredCallCount += 1;
    },
  });
  eventRegistry.on({
    target: differentTargetOtherTarget,
    key: "different-target-ignored",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      differentTargetIgnoredCallCount += 1;
    },
  });
  eventRegistry.on({
    target: differentTargetGuardTarget,
    key: "different-event-ignored",
    eventKey: "ElementsUpdated",
    listenerDomain: eventTestDomains.elements,
    listener: () => {
      differentEventIgnoredCallCount += 1;
    },
  });
  eventRegistry.emit({
    target: differentTargetGuardTarget,
    eventKey: "PageUrlChanged",
    ownerDomain: eventTestDomains.page,
    payload: originalPagePayload,
  });

  eventRegistry.on({
    target,
    key: "duplicate",
    eventKey: "VideoTimeChanged",
    listenerDomain: eventTestDomains.time,
    listener: () => {
      duplicateFirstCalled = true;
    },
  });
  eventRegistry.on({
    target,
    key: "duplicate",
    eventKey: "VideoTimeChanged",
    listenerDomain: eventTestDomains.time,
    listener: () => {
      duplicateSecondCalled = true;
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "VideoTimeChanged",
    ownerDomain: eventTestDomains.time,
    payload: { currentTime: 10, duration: 30 },
  });

  const unsubscribe = eventRegistry.on({
    target,
    key: "unsubscribe",
    eventKey: "VideoInfoChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      unsubscribeCalled = true;
    },
  });
  unsubscribe();
  eventRegistry.emit({
    target,
    eventKey: "VideoInfoChanged",
    ownerDomain: eventTestDomains.status,
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
    listenerDomain: eventTestDomains.pip,
    listener: () => undefined,
  });
  eventRegistry.on({
    target,
    key: "off-b",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.page,
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
    listenerDomain: eventTestDomains.status,
    listener: () => {
      reAddFirstCalled = true;
    },
  });
  eventRegistry.off("re-add");
  eventRegistry.on({
    target,
    key: "re-add",
    eventKey: "StatusChanged",
    listenerDomain: eventTestDomains.status,
    listener: () => {
      reAddSecondCalled = true;
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    ownerDomain: eventTestDomains.status,
    payload: statusPayload,
  });

  eventRegistry.on({
    target,
    key: "page-first",
    eventKey: "PageUrlChanged",
    listenerDomain: eventTestDomains.page,
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
    listenerDomain: eventTestDomains.page,
    listener: (payload) => {
      pageSecondListenerSawOriginalUrl = payload.url === originalPagePayload.url;
    },
  });
  eventRegistry.on({
    target,
    key: "elements",
    eventKey: "ElementsUpdated",
    listenerDomain: eventTestDomains.elements,
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
    ownerDomain: eventTestDomains.page,
    payload: originalPagePayload,
  });
  eventRegistry.emit({
    target,
    eventKey: "ElementsUpdated",
    ownerDomain: eventTestDomains.elements,
    payload: originalElementsPayload,
  });
  eventRegistry.on({
    target,
    key: "null-prototype",
    eventKey: "StatusChanged",
    listenerDomain: eventTestDomains.status,
    listener: (payload) => {
      nullPrototypePayloadCloned = payload !== nullPrototypeStatusPayload;
      nullPrototypePayloadFrozen = Object.isFrozen(payload);
      nullPrototypePayloadPreserved = payload.status === "ready";
    },
  });
  eventRegistry.emit({
    target,
    eventKey: "StatusChanged",
    ownerDomain: eventTestDomains.status,
    payload: nullPrototypeStatusPayload,
  });

  return {
    statusListenerReceivedReady,
    foreignStatusListenerRegistrationRejected:
      foreignStatusRegistrationThrew &&
      rejectedForeignStatusListenerCallCount === 0 &&
      acceptedOwnerStatusListenerCallCount === 1,
    allowedCrossDomainPageListenerDelivered: allowedCrossDomainPageListenerCallCount === 1,
    listenerOrderGuardRejected:
      listenerOrderRegistrationThrew &&
      rejectedLateElementsListenerCallCount === 0 &&
      acceptedOwnerElementsListenerCallCount === 1,
    ownerMismatchPageEmitBlocked:
      ownerMismatchEmitThrew &&
      ownerMismatchPageOwnerListenerCallCount === 0 &&
      ownerMismatchPageForeignListenerCallCount === 0,
    emitIgnoredDifferentTargetAndDifferentEvent:
      differentTargetDeliveredCallCount === 1 &&
      differentTargetIgnoredCallCount === 0 &&
      differentEventIgnoredCallCount === 0,
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
