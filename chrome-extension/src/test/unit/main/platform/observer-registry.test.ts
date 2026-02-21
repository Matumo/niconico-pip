/**
 * オブザーバーレジストリテスト
 */
import { describe, expect, test } from "vitest";
import { createObserverRegistry } from "@main/platform/observer-registry";
import { captureGlobalDescriptors, restoreGlobalDescriptors } from "@test/unit/main/shared/global-property";

// テスト用MutationObserver
class FakeMutationObserver {
  public readonly callback: MutationCallback;
  public observeCalls = 0;
  public disconnectCalls = 0;

  public constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  public observe(): void {
    this.observeCalls += 1;
  }

  public disconnect(): void {
    this.disconnectCalls += 1;
  }
}

describe("オブザーバーレジストリ", () => {
  test("createObserver注入時はMutationObserver未定義でも動作すること", () => {
    const globalDescriptors = captureGlobalDescriptors(["MutationObserver"] as const);
    Reflect.deleteProperty(globalThis, "MutationObserver");

    try {
      const observerRegistry = createObserverRegistry({
        createObserver: () =>
          ({
            observe: () => undefined,
            disconnect: () => undefined,
            takeRecords: () => [],
          }) as MutationObserver,
      });
      const target = {} as Node;

      const observer = observerRegistry.observe({
        key: "noop",
        target,
        callback: () => undefined,
        options: { childList: true },
      });

      expect(observer.takeRecords()).toEqual([]);
      expect(observerRegistry.size()).toBe(1);
      expect(observerRegistry.disconnect("noop")).toBe(true);
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("MutationObserver定義時にグローバル実装を利用すること", () => {
    const globalDescriptors = captureGlobalDescriptors(["MutationObserver"] as const);
    const observeCalls: MutationObserverInit[] = [];

    class GlobalMutationObserverMock {
      public observe(_target: Node, options: MutationObserverInit): void {
        observeCalls.push(options);
      }
      public disconnect(): void {
        return undefined;
      }
      public takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = GlobalMutationObserverMock as unknown as typeof MutationObserver;

    try {
      const observerRegistry = createObserverRegistry();
      observerRegistry.observe({
        key: "global",
        target: {} as Node,
        callback: () => undefined,
        options: { attributes: true },
      });

      expect(observeCalls).toEqual([{ attributes: true }]);
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("重複キー登録時にオブザーバーを差し替えること", () => {
    const instances: FakeMutationObserver[] = [];
    const observerRegistry = createObserverRegistry({
      createObserver: (callback) => {
        const observer = new FakeMutationObserver(callback) as unknown as MutationObserver;
        instances.push(observer as unknown as FakeMutationObserver);
        return observer;
      },
    });

    const target = {} as Node;
    observerRegistry.observe({
      key: "observer",
      target,
      callback: () => undefined,
      options: { childList: true },
    });
    observerRegistry.observe({
      key: "observer",
      target,
      callback: () => undefined,
      options: { childList: true },
    });

    expect(observerRegistry.size()).toBe(1);
    expect(instances[0].disconnectCalls).toBe(1);
  });

  test("disconnectとdisconnectAllで解除できること", () => {
    const observerRegistry = createObserverRegistry({
      createObserver: (callback) => new FakeMutationObserver(callback) as unknown as MutationObserver,
    });

    const target = {} as Node;

    observerRegistry.observe({
      key: "x",
      target,
      callback: () => undefined,
      options: { childList: true },
    });
    observerRegistry.observe({
      key: "y",
      target,
      callback: () => undefined,
      options: { childList: true },
    });

    expect(observerRegistry.disconnect("x")).toBe(true);
    expect(observerRegistry.disconnect("missing")).toBe(false);

    observerRegistry.disconnectAll();
    expect(observerRegistry.size()).toBe(0);
  });

  test("add -> remove -> add で同一キーを再登録できること", () => {
    const instances: FakeMutationObserver[] = [];
    const observerRegistry = createObserverRegistry({
      createObserver: (callback) => {
        const observer = new FakeMutationObserver(callback) as unknown as MutationObserver;
        instances.push(observer as unknown as FakeMutationObserver);
        return observer;
      },
    });

    const target = {} as Node;
    observerRegistry.observe({
      key: "re-add",
      target,
      callback: () => undefined,
      options: { childList: true },
    });
    expect(observerRegistry.disconnect("re-add")).toBe(true);

    observerRegistry.observe({
      key: "re-add",
      target,
      callback: () => undefined,
      options: { childList: true },
    });

    expect(observerRegistry.size()).toBe(1);
    expect(instances[0].disconnectCalls).toBe(1);
    expect(instances[1].observeCalls).toBe(1);
  });
});
