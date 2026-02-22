/**
 * pageドメインテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import { createPageDomain } from "@main/domain/page";
import type {
  CreateUrlChangeObserverOptions,
  UrlCheckTrigger,
  UrlChangeObserver,
} from "@main/adapter/dom/url-change-observer";
import type { AppContext, AppObserverRegistry, AppStateWriters } from "@main/types/app-context";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import { createMockAppLoggers, createMockLogger } from "@test/unit/main/shared/logger";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const { createUrlChangeObserverMock } = vi.hoisted(() => ({
  createUrlChangeObserverMock: vi.fn(),
}));

vi.mock("@main/adapter/dom/url-change-observer", async () => ({
  createUrlChangeObserver: createUrlChangeObserverMock,
}));

// テストで差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["location", "dispatchEvent"] as const;

// pageドメインテスト用コンテキストを作成する関数
const createPageDomainTestContext = (initialUrl: string) => {
  const pageState = {
    url: initialUrl,
    isWatchPage: true,
    generation: 0,
  };
  const pagePatch = vi.fn((partial: Partial<typeof pageState>) => {
    Object.assign(pageState, partial);
  });
  const domainLogger = createMockLogger("test-page-domain");
  const observerRegistry = {
    observe: vi.fn(() => ({ disconnect: vi.fn() }) as unknown as MutationObserver),
    disconnect: vi.fn(() => false),
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  } as AppObserverRegistry;
  const eventRegistryEmit = vi.fn();

  const context: AppContext = {
    config: createAppConfig(),
    loggers: createMockAppLoggers({
      domain: domainLogger,
    }),
    eventRegistry: {
      on: vi.fn(() => () => undefined),
      emit: eventRegistryEmit,
      off: vi.fn(() => false),
      clear: vi.fn(),
      size: vi.fn(() => 0),
    },
    observerRegistry,
    state: {
      page: { get: () => ({ ...pageState }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false, reason: "unknown" as const }) },
      info: { get: () => ({ title: null, videoId: null }) },
    },
    elementResolver: {
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient: createForbiddenHttpClient("page domain tests"),
  };

  const stateWriters: AppStateWriters = {
    page: { set: vi.fn(), patch: pagePatch, reset: vi.fn() },
    elements: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    status: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    time: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    pip: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    info: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  };

  return {
    context,
    stateWriters,
    pagePatch,
    eventRegistryEmit,
    observerRegistry,
    domainLogger,
  };
};

// URL監視オブザーバーのモックを準備する関数
const prepareUrlChangeObserverMock = () => {
  let onUrlCheckRequested: ((trigger: UrlCheckTrigger) => void) | null = null;
  const start = vi.fn();
  const stop = vi.fn();

  createUrlChangeObserverMock.mockImplementation((options: CreateUrlChangeObserverOptions): UrlChangeObserver => {
    onUrlCheckRequested = options.onUrlCheckRequested;
    return { start, stop };
  });

  const emitTrigger = (trigger: UrlCheckTrigger): void => {
    if (!onUrlCheckRequested) {
      throw new Error("onUrlCheckRequested is not initialized");
    }
    onUrlCheckRequested(trigger);
  };

  return {
    start,
    stop,
    emitTrigger,
  };
};

describe("pageドメイン", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    createUrlChangeObserverMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("init/start/stopでURL監視オブジェクトを正しく呼び出すこと", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const { context, stateWriters, observerRegistry, domainLogger } = createPageDomainTestContext(initialUrl);
    const { start, stop } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    await domain.init(context, stateWriters);
    await domain.start();
    await domain.stop();

    expect(createUrlChangeObserverMock).toHaveBeenCalledWith({
      observerRegistry,
      onUrlCheckRequested: expect.any(Function),
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(domainLogger.debug).toHaveBeenCalledWith("page domain init completed");
    expect(domainLogger.debug).toHaveBeenCalledWith("page domain start completed");
    expect(domainLogger.debug).toHaveBeenCalledWith("page domain stopping");
  });

  test("URL変更時にstate更新とPageUrlChangedイベント通知を行うこと", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const changedUrl = "https://www.nicovideo.jp/watch/sm10";
    const { context, stateWriters, pagePatch, eventRegistryEmit, domainLogger } = createPageDomainTestContext(initialUrl);
    const { emitTrigger } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    setGlobalProperty("location", { href: changedUrl });
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    emitTrigger("mutation-observer");

    expect(pagePatch).toHaveBeenCalledWith({
      url: changedUrl,
      isWatchPage: true,
      generation: 1,
    });
    expect(eventRegistryEmit).toHaveBeenCalledWith({
      target: globalThis,
      eventKey: "PageUrlChanged",
      payload: {
        url: changedUrl,
        generation: 1,
      },
    });
    expect(domainLogger.info).toHaveBeenCalledWith(
      `page url changed: ${changedUrl} (trigger=mutation-observer)`,
    );
  });

  test("同一URLの場合はstate更新とイベント通知をスキップすること", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const { context, stateWriters, pagePatch, eventRegistryEmit, domainLogger } = createPageDomainTestContext(initialUrl);
    const { emitTrigger } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    setGlobalProperty("location", { href: initialUrl });
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    emitTrigger("popstate");

    expect(pagePatch).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.debug).toHaveBeenCalledWith("page url unchanged (trigger=popstate)");
  });

  test("location.hrefが使えない場合はwarnしてスキップすること", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const { context, stateWriters, pagePatch, eventRegistryEmit, domainLogger } = createPageDomainTestContext(initialUrl);
    const { emitTrigger } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    setGlobalProperty("location", undefined);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    emitTrigger("initial-start");

    expect(pagePatch).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.warn).toHaveBeenCalledWith(
      "page url sync skipped: location.href is unavailable (trigger=initial-start)",
    );
  });

  test("event targetが利用できない場合はstate更新後にwarnすること", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const changedUrl = "https://www.nicovideo.jp/watch/sm10";
    const { context, stateWriters, pagePatch, eventRegistryEmit, domainLogger } = createPageDomainTestContext(initialUrl);
    const { emitTrigger } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    setGlobalProperty("location", { href: changedUrl });
    setGlobalProperty("dispatchEvent", undefined);

    await domain.init(context, stateWriters);
    await domain.start();
    emitTrigger("mutation-observer");

    expect(pagePatch).toHaveBeenCalledWith({
      url: changedUrl,
      isWatchPage: true,
      generation: 1,
    });
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.warn).toHaveBeenCalledWith(
      "PageUrlChanged emit skipped: global event target is unavailable",
    );
  });

  test("init前のstopは何もせず完了すること", async () => {
    const domain = createPageDomain();

    await expect(domain.stop()).resolves.toBeUndefined();
    expect(createUrlChangeObserverMock).not.toHaveBeenCalled();
  });

  test("stop後に遅延トリガーが来た場合は未初期化例外になること", async () => {
    const initialUrl = "https://www.nicovideo.jp/watch/sm9";
    const { context, stateWriters } = createPageDomainTestContext(initialUrl);
    const { emitTrigger } = prepareUrlChangeObserverMock();
    const domain = createPageDomain();

    setGlobalProperty("location", { href: "https://www.nicovideo.jp/watch/sm10" });
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    await domain.stop();

    // TODO: 本体側で未初期化時の回復動作を実装したら、この期待値を例外なしへ見直す
    expect(() => emitTrigger("mutation-observer")).toThrowError(
      "Page domain runtime is not initialized",
    );
  });
});
