/**
 * ドメインテスト
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAdDomain } from "@main/domain/ad";
import { createControllerDomain } from "@main/domain/controller";
import { createElementsDomain } from "@main/domain/elements";
import { createMediaSessionDomain } from "@main/domain/media-session";
import { createPageDomain } from "@main/domain/page";
import { createStatusDomain } from "@main/domain/status";
import { createTimeDomain } from "@main/domain/time";
import { createDomainModule } from "@main/domain/create-domain-module";
import { createAppConfig } from "@main/config/config";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import type {
  AppContext,
  AppEventRegistry,
  AppObserverRegistry,
  AppStateWriters,
} from "@main/types/app-context";
import type { PipVideoElementAdapter } from "@main/adapter/media/pip-video-element";

let createPipDomain: typeof import("@main/domain/pip").createPipDomain;

// ドメインテスト用コンテキストを作成する関数
const createDomainTestContext = (): AppContext => {
  const eventRegistry: AppEventRegistry = {
    on: vi.fn(() => () => undefined),
    emit: vi.fn(),
    off: vi.fn(() => false),
    clear: vi.fn(),
    size: vi.fn(() => 0),
  };
  const observerRegistry: AppObserverRegistry = {
    observe: vi.fn(() => ({ disconnect: vi.fn() }) as unknown as MutationObserver),
    disconnect: vi.fn(() => false),
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  };

  return {
    config: createAppConfig(),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: false, generation: 0 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false }) },
      info: { get: () => ({
        title: null,
        author: null,
        thumbnail: null,
        pageGeneration: 0,
        infoGeneration: 0,
      }) },
    },
    elementResolver: {
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient: createForbiddenHttpClient("domain tests"),
  };
};

const stateWriters: AppStateWriters = {
  page: { set: () => undefined, patch: () => undefined, reset: () => undefined },
  elements: { set: () => undefined, patch: () => undefined, reset: () => undefined },
  status: { set: () => undefined, patch: () => undefined, reset: () => undefined },
  time: { set: () => undefined, patch: () => undefined, reset: () => undefined },
  pip: { set: () => undefined, patch: () => undefined, reset: () => undefined },
  info: { set: () => undefined, patch: () => undefined, reset: () => undefined },
};

// PiP動画要素アダプターのモック生成関数
const createPipVideoElementAdapterMock = vi.fn(
  (): PipVideoElementAdapter => ({
    getElement: () => new EventTarget() as unknown as HTMLVideoElement,
    ensureInserted: vi.fn(() => true),
    updateSize: vi.fn(() => true),
    updatePoster: vi.fn(async () => true),
    requestPictureInPicture: vi.fn(async () => true),
    isOwnPictureInPictureElement: vi.fn(() => false),
    stop: vi.fn(),
  }),
);

describe("ドメインモジュール", () => {
  beforeEach(async () => {
    vi.resetModules();
    createPipVideoElementAdapterMock.mockClear();
    vi.doMock("@main/adapter/media/pip-video-element", async () => ({
      createPipVideoElementAdapter: createPipVideoElementAdapterMock,
    }));
    ({ createPipDomain } = await import("@main/domain/pip"));
  });

  test("各ファクトリーが期待どおりのドメインを返すこと", async () => {
    const context = createDomainTestContext();
    const modules = [
      createPageDomain(),
      createElementsDomain(),
      createStatusDomain(),
      createTimeDomain(),
      createControllerDomain(),
      createMediaSessionDomain(),
      createPipDomain(),
      createAdDomain(),
    ];

    expect(modules.map((module) => module.name)).toEqual([
      "page",
      "elements",
      "status",
      "time",
      "controller",
      "media-session",
      "pip",
      "ad",
    ]);

    for (const module of modules) {
      await module.init(context, stateWriters);
      await module.start();
      await module.stop();
    }
  });

  test("init前のstartで例外を返すこと", async () => {
    const module = createDomainModule("sample", "control");

    await expect(module.start()).rejects.toThrowError(/must be initialized/);
  });
});
