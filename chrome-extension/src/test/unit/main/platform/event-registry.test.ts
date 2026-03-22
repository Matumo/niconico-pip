/**
 * イベントレジストリテスト
 */
import { describe, expect, test, vi } from "vitest";
import { selectorDefinitions } from "@main/config/selector";
import { type AppEventMap, type ElementsSnapshot } from "@main/config/event";
import { createEventRegistry } from "@main/platform/event-registry";
import { createAppEventNameMap } from "@main/config/event";
import type { DomainName } from "@main/domain/shared/domain-name";

// 空の要素スナップショットを作る関数
const createEmptyElementsSnapshot = (): ElementsSnapshot => {
  const snapshot = {} as ElementsSnapshot;
  for (const key of Object.keys(selectorDefinitions) as (keyof ElementsSnapshot)[]) {
    snapshot[key] = null;
  }
  return snapshot;
};

// null値を検出したら例外にする関数
const resolveRequiredValue = <T>(value: T | null, errorMessage: string): NonNullable<T> => {
  if (value === null) throw new Error(errorMessage);
  return value as NonNullable<T>;
};

const eventTestDomains = {
  page: "page",
  elements: "elements",
  status: "status",
  time: "time",
  pip: "pip",
} as const satisfies Record<string, DomainName>;

describe("イベントレジストリ", () => {
  test("型付きイベントを登録して発火できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const listener = vi.fn();

    eventRegistry.on({
      target,
      key: "listener-1",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.status,
      listener,
    });

    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
      ownerDomain: eventTestDomains.status,
      payload: { status: "ready" },
    });

    expect(listener).toHaveBeenCalledWith({ status: "ready" });
    expect(eventRegistry.size()).toBe(1);
  });

  test("重複キーを上書きできること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const first = vi.fn();
    const second = vi.fn();

    eventRegistry.on({
      target,
      key: "duplicate",
      eventKey: "VideoTimeChanged",
      listenerDomain: eventTestDomains.time,
      listener: first,
    });

    eventRegistry.on({
      target,
      key: "duplicate",
      eventKey: "VideoTimeChanged",
      listenerDomain: eventTestDomains.time,
      listener: second,
    });

    eventRegistry.emit({
      target,
      eventKey: "VideoTimeChanged",
      ownerDomain: eventTestDomains.time,
      payload: { currentTime: 10, duration: 30 },
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(eventRegistry.size()).toBe(1);
  });

  test("unsubscribeでリスナーを解除できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const listener = vi.fn();

    const unsubscribe = eventRegistry.on({
      target,
      key: "unsubscribe",
      eventKey: "VideoInfoChanged",
      listenerDomain: eventTestDomains.status,
      listener,
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

    expect(listener).not.toHaveBeenCalled();
    expect(eventRegistry.size()).toBe(0);
  });

  test("offとclearで登録を解除できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));

    eventRegistry.on({
      target,
      key: "a",
      eventKey: "PipStatusChanged",
      listenerDomain: eventTestDomains.pip,
      listener: vi.fn(),
    });
    eventRegistry.on({
      target,
      key: "b",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.page,
      listener: vi.fn(),
    });

    expect(eventRegistry.off("a")).toBe(true);
    expect(eventRegistry.off("missing")).toBe(false);

    eventRegistry.clear();
    expect(eventRegistry.size()).toBe(0);
  });

  test("add -> remove -> addで同一キーを再登録できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const first = vi.fn();
    const second = vi.fn();

    eventRegistry.on({
      target,
      key: "re-add",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.status,
      listener: first,
    });
    expect(eventRegistry.off("re-add")).toBe(true);

    eventRegistry.on({
      target,
      key: "re-add",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.status,
      listener: second,
    });
    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
      ownerDomain: eventTestDomains.status,
      payload: { status: "ready" },
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(eventRegistry.size()).toBe(1);
  });

  test("emit時にpayloadを読み取り専用のcloneへ変換して後続listenerへ渡すこと", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const originalPayload: AppEventMap["PageUrlChanged"] = {
      url: "https://example.test/watch/sm9",
      generation: 1,
      isWatchPage: true,
      changedKeys: ["url"] as const,
    };

    let firstPayload: AppEventMap["PageUrlChanged"] | null = null;
    let secondPayload: AppEventMap["PageUrlChanged"] | null = null;
    let topLevelMutationRejected = false;
    let changedKeysMutationRejected = false;

    eventRegistry.on({
      target,
      key: "readonly-first",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.page,
      listener: (payload) => {
        firstPayload = payload;
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
      key: "readonly-second",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.page,
      listener: (payload) => {
        secondPayload = payload;
      },
    });

    eventRegistry.emit({
      target,
      eventKey: "PageUrlChanged",
      ownerDomain: eventTestDomains.page,
      payload: originalPayload,
    });

    const receivedFirstPayload = resolveRequiredValue<AppEventMap["PageUrlChanged"]>(
      firstPayload,
      "PageUrlChanged listener did not receive payload",
    );
    const receivedSecondPayload = resolveRequiredValue<AppEventMap["PageUrlChanged"]>(
      secondPayload,
      "PageUrlChanged listener did not receive payload",
    );

    expect(receivedFirstPayload).not.toBe(originalPayload);
    expect(receivedFirstPayload.changedKeys).not.toBe(originalPayload.changedKeys);
    expect(Object.isFrozen(receivedFirstPayload)).toBe(true);
    expect(Object.isFrozen(receivedFirstPayload.changedKeys)).toBe(true);
    expect(topLevelMutationRejected).toBe(true);
    expect(changedKeysMutationRejected).toBe(true);
    expect(receivedSecondPayload).toEqual(originalPayload);
    expect(Object.isFrozen(originalPayload)).toBe(false);
    expect(Object.isFrozen(originalPayload.changedKeys)).toBe(false);
  });

  test("emit時にnested plain objectも読み取り専用のcloneへ変換すること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const originalSnapshot = createEmptyElementsSnapshot();
    const originalPayload: AppEventMap["ElementsUpdated"] = {
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["video"] as const,
      snapshot: originalSnapshot,
    };

    let receivedPayload: AppEventMap["ElementsUpdated"] | null = null;
    let snapshotMutationRejected = false;

    eventRegistry.on({
      target,
      key: "readonly-elements",
      eventKey: "ElementsUpdated",
      listenerDomain: eventTestDomains.elements,
      listener: (payload) => {
        receivedPayload = payload;
        snapshotMutationRejected = Reflect.set(
          payload.snapshot as unknown as Record<string, unknown>,
          "video",
          "mutated-video",
        ) === false;
      },
    });

    eventRegistry.emit({
      target,
      eventKey: "ElementsUpdated",
      ownerDomain: eventTestDomains.elements,
      payload: originalPayload,
    });

    const receivedElementsPayload = resolveRequiredValue<AppEventMap["ElementsUpdated"]>(
      receivedPayload,
      "ElementsUpdated listener did not receive payload",
    );

    expect(receivedElementsPayload.snapshot).not.toBe(originalSnapshot);
    expect(Object.isFrozen(receivedElementsPayload.snapshot)).toBe(true);
    expect(snapshotMutationRejected).toBe(true);
    expect(Object.isFrozen(originalSnapshot)).toBe(false);
  });

  test("prototypeがnullのplain objectも読み取り専用のcloneへ変換すること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const originalPayload = Object.assign(Object.create(null), {
      status: "ready" as const,
    }) as AppEventMap["StatusChanged"];

    let receivedPayload: AppEventMap["StatusChanged"] | null = null;

    eventRegistry.on({
      target,
      key: "null-prototype",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.status,
      listener: (payload) => {
        receivedPayload = payload;
      },
    });

    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
      ownerDomain: eventTestDomains.status,
      payload: originalPayload,
    });

    const readonlyPayload = resolveRequiredValue<AppEventMap["StatusChanged"]>(
      receivedPayload,
      "StatusChanged listener did not receive payload",
    );

    expect(Object.getPrototypeOf(originalPayload)).toBeNull();
    expect(readonlyPayload).not.toBe(originalPayload);
    expect(readonlyPayload).toEqual({ status: "ready" });
    expect(Object.isFrozen(readonlyPayload)).toBe(true);
    expect(Object.isFrozen(originalPayload)).toBe(false);
  });

  test("allowCrossDomainEmit=falseのeventはforeign listener登録を拒否すること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const foreignListener = vi.fn();
    const ownerListener = vi.fn();

    expect(() => eventRegistry.on({
      target,
      key: "foreign-status-listener",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.page,
      listener: foreignListener,
    })).toThrowError("event listener registration blocked: StatusChanged owned by status cannot register foreign listener owned by page");
    eventRegistry.on({
      target,
      key: "owner-status-listener",
      eventKey: "StatusChanged",
      listenerDomain: eventTestDomains.status,
      listener: ownerListener,
    });

    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
      ownerDomain: eventTestDomains.status,
      payload: { status: "ready" },
    });

    expect(foreignListener).not.toHaveBeenCalled();
    expect(ownerListener).toHaveBeenCalledTimes(1);
    expect(eventRegistry.size()).toBe(1);
  });

  test("allowCrossDomainEmit=trueのeventはforeign listenerへ配信できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const listener = vi.fn();

    eventRegistry.on({
      target,
      key: "unguarded-page-url-changed",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.status,
      listener,
    });

    eventRegistry.emit({
      target,
      eventKey: "PageUrlChanged",
      ownerDomain: eventTestDomains.page,
      payload: {
        url: "https://example.test/watch/sm9",
        generation: 1,
        isWatchPage: true,
        changedKeys: ["url"],
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("allowCrossDomainEmit=trueでもownerより後ろのdomainはforeign listener登録を拒否すること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const lateListener = vi.fn();
    const ownerListener = vi.fn();

    expect(() => eventRegistry.on({
      target,
      key: "late-elements-listener",
      eventKey: "ElementsUpdated",
      listenerDomain: eventTestDomains.page,
      listener: lateListener,
    })).toThrowError("event listener registration blocked: ElementsUpdated owned by elements cannot register listener owned by page after owner domain in bootstrap start order");
    eventRegistry.on({
      target,
      key: "owner-elements-listener",
      eventKey: "ElementsUpdated",
      listenerDomain: eventTestDomains.elements,
      listener: ownerListener,
    });

    eventRegistry.emit({
      target,
      eventKey: "ElementsUpdated",
      ownerDomain: eventTestDomains.elements,
      payload: {
        pageGeneration: 1,
        elementsGeneration: 1,
        changedKeys: ["video"],
        snapshot: createEmptyElementsSnapshot(),
      },
    });

    expect(lateListener).not.toHaveBeenCalled();
    expect(ownerListener).toHaveBeenCalledTimes(1);
    expect(eventRegistry.size()).toBe(1);
  });

  test("ownerDomainと異なるdomainからのemitはdispatch前に例外で中止すること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const ownerListener = vi.fn();
    const foreignListener = vi.fn();

    eventRegistry.on({
      target,
      key: "owner-page-listener",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.page,
      listener: ownerListener,
    });
    eventRegistry.on({
      target,
      key: "foreign-page-listener",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.status,
      listener: foreignListener,
    });

    expect(() => eventRegistry.emit({
      target,
      eventKey: "PageUrlChanged",
      ownerDomain: eventTestDomains.status,
      payload: {
        url: "https://example.test/watch/sm9",
        generation: 1,
        isWatchPage: true,
        changedKeys: ["url"],
      },
    })).toThrowError("event emit blocked: PageUrlChanged from status must be emitted by page");

    expect(ownerListener).not.toHaveBeenCalled();
    expect(foreignListener).not.toHaveBeenCalled();
  });

  test("emit時は別targetや別eventKeyの登録を無視して一致listenerだけへ配信すること", () => {
    const target = new EventTarget();
    const otherTarget = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const deliveredListener = vi.fn();
    const differentTargetListener = vi.fn();
    const differentEventListener = vi.fn();

    eventRegistry.on({
      target,
      key: "delivered-page-listener",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.page,
      listener: deliveredListener,
    });
    eventRegistry.on({
      target: otherTarget,
      key: "different-target-page-listener",
      eventKey: "PageUrlChanged",
      listenerDomain: eventTestDomains.status,
      listener: differentTargetListener,
    });
    eventRegistry.on({
      target,
      key: "different-event-listener",
      eventKey: "ElementsUpdated",
      listenerDomain: eventTestDomains.elements,
      listener: differentEventListener,
    });

    eventRegistry.emit({
      target,
      eventKey: "PageUrlChanged",
      ownerDomain: eventTestDomains.page,
      payload: {
        url: "https://example.test/watch/sm9",
        generation: 1,
        isWatchPage: true,
        changedKeys: ["url"],
      },
    });

    expect(deliveredListener).toHaveBeenCalledTimes(1);
    expect(differentTargetListener).not.toHaveBeenCalled();
    expect(differentEventListener).not.toHaveBeenCalled();
  });

});
