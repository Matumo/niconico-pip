/**
 * イベントレジストリテスト
 */
import { describe, expect, test, vi } from "vitest";
import { createEventRegistry } from "@main/platform/event-registry";
import { createAppEventNameMap } from "@main/config/event";

describe("イベントレジストリ", () => {
  test("型付きイベントを登録して発火できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const listener = vi.fn();

    eventRegistry.on({
      target,
      key: "listener-1",
      eventKey: "StatusChanged",
      listener,
    });

    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
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
      listener: first,
    });

    eventRegistry.on({
      target,
      key: "duplicate",
      eventKey: "VideoTimeChanged",
      listener: second,
    });

    eventRegistry.emit({
      target,
      eventKey: "VideoTimeChanged",
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
      listener,
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
      listener: vi.fn(),
    });
    eventRegistry.on({
      target,
      key: "b",
      eventKey: "PageUrlChanged",
      listener: vi.fn(),
    });

    expect(eventRegistry.off("a")).toBe(true);
    expect(eventRegistry.off("missing")).toBe(false);

    eventRegistry.clear();
    expect(eventRegistry.size()).toBe(0);
  });

  test("add -> remove -> add で同一キーを再登録できること", () => {
    const target = new EventTarget();
    const eventRegistry = createEventRegistry(createAppEventNameMap("test-prefix"));
    const first = vi.fn();
    const second = vi.fn();

    eventRegistry.on({
      target,
      key: "re-add",
      eventKey: "StatusChanged",
      listener: first,
    });
    expect(eventRegistry.off("re-add")).toBe(true);

    eventRegistry.on({
      target,
      key: "re-add",
      eventKey: "StatusChanged",
      listener: second,
    });
    eventRegistry.emit({
      target,
      eventKey: "StatusChanged",
      payload: { status: "ready" },
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(eventRegistry.size()).toBe(1);
  });
});
