/**
 * pipドメイン表示同期テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEventMap } from "@main/config/event";
import type { PipDomainRuntime } from "@main/domain/pip/pip-runtime";
import {
  syncOwnPipPresentation,
  syncPipEnabled,
  syncSourceVisibilityForPipEnabled,
  updateRendererSources,
} from "@main/domain/pip/pip-presentation";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const { requestExitBrowserSizeFullscreenForOwnPipEnterMock } = vi.hoisted(() => ({
  requestExitBrowserSizeFullscreenForOwnPipEnterMock: vi.fn(),
}));

vi.mock("@main/domain/pip/pip-fullscreen", () => ({
  requestExitBrowserSizeFullscreenForOwnPipEnter: requestExitBrowserSizeFullscreenForOwnPipEnterMock,
}));

vi.mock("@matumo/ts-simple-logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

const globalPropertyKeys = ["dispatchEvent", "document"] as const;

const createHiddenElement = <T extends HTMLElement>(): T =>
  Object.assign(new EventTarget(), {
    hidden: false,
  }) as unknown as T;

const createEmptySnapshot = (
  overrides: Partial<AppEventMap["ElementsUpdated"]["snapshot"]> = {},
): AppEventMap["ElementsUpdated"]["snapshot"] => ({
  commentToggleButton: null,
  fullscreenToggleButton: null,
  playerContainer: null,
  playerMenu: null,
  video: null,
  commentsCanvas: null,
  ...overrides,
});

const createRuntime = (initialEnabled = false): {
  runtime: PipDomainRuntime;
  emittedEvents: Array<{
    eventKey: string;
    payload: unknown;
    target: EventTarget;
  }>;
  pipPatch: ReturnType<typeof vi.fn>;
  pipStreamStart: ReturnType<typeof vi.fn>;
  pipStreamStop: ReturnType<typeof vi.fn>;
  pipVideoElement: HTMLVideoElement;
  rendererSetSources: ReturnType<typeof vi.fn>;
} => {
  const emittedEvents: Array<{
    eventKey: string;
    payload: unknown;
    target: EventTarget;
  }> = [];
  let pipEnabled = initialEnabled;
  const pipPatch = vi.fn((partial: { enabled?: boolean }) => {
    if (typeof partial.enabled === "boolean") pipEnabled = partial.enabled;
  });
  const pipStreamStart = vi.fn(() => true);
  const pipStreamStop = vi.fn();
  const rendererSetSources = vi.fn();
  const pipVideoElement = createHiddenElement<HTMLVideoElement>();
  pipVideoElement.hidden = true;

  const runtime = {
    context: {
      state: {
        pip: {
          get: () => ({ enabled: pipEnabled }),
        },
      },
      eventRegistry: {
        emit: (params: {
          target: EventTarget;
          eventKey: string;
          payload: unknown;
        }) => {
          emittedEvents.push(params);
        },
      },
    },
    stateWriters: {
      pip: {
        patch: pipPatch,
      },
    },
    pipVideoElementAdapter: {
      getElement: () => pipVideoElement,
    },
    pipRenderer: {
      setSources: rendererSetSources,
    },
    pipStream: {
      start: pipStreamStart,
      stop: pipStreamStop,
    },
    sourceVideoElement: null,
    sourceCommentsCanvas: null,
    hiddenSourceElements: new Set<HTMLElement>(),
    fullscreenToggleButton: null,
    browserSizeFullscreenActive: null,
  } as unknown as PipDomainRuntime;

  return {
    runtime,
    emittedEvents,
    pipPatch,
    pipStreamStart,
    pipStreamStop,
    pipVideoElement,
    rendererSetSources,
  };
};

describe("pipドメイン表示同期", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    requestExitBrowserSizeFullscreenForOwnPipEnterMock.mockReset();
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
    vi.restoreAllMocks();
  });

  test("描画ソース更新でruntimeとrendererを同期すること", () => {
    const { runtime, rendererSetSources } = createRuntime();
    const video = createHiddenElement<HTMLVideoElement>();
    const commentsCanvas = createHiddenElement<HTMLCanvasElement>();

    updateRendererSources(runtime, createEmptySnapshot({
      video,
      commentsCanvas,
    }));

    expect(runtime.sourceVideoElement).toBe(video);
    expect(runtime.sourceCommentsCanvas).toBe(commentsCanvas);
    expect(rendererSetSources).toHaveBeenCalledWith({
      video,
      commentsCanvas,
    });
  });

  test("現在の描画ソースだけをhidden同期し、不要なhiddenを解除すること", () => {
    const { runtime } = createRuntime();
    const previousHidden = createHiddenElement<HTMLDivElement>();
    previousHidden.hidden = true;
    const video = createHiddenElement<HTMLVideoElement>();
    const commentsCanvas = createHiddenElement<HTMLCanvasElement>();

    runtime.hiddenSourceElements.add(previousHidden);
    runtime.sourceVideoElement = video;
    runtime.sourceCommentsCanvas = commentsCanvas;

    syncSourceVisibilityForPipEnabled(runtime);

    expect(previousHidden.hidden).toBe(false);
    expect(video.hidden).toBe(true);
    expect(commentsCanvas.hidden).toBe(true);
    expect(runtime.hiddenSourceElements.has(video)).toBe(true);
    expect(runtime.hiddenSourceElements.has(commentsCanvas)).toBe(true);
    expect(runtime.hiddenSourceElements.has(previousHidden)).toBe(false);
  });

  test("PiP enabled更新でstate patchとイベント通知を同期すること", () => {
    const { runtime, emittedEvents, pipPatch } = createRuntime(false);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    syncPipEnabled(runtime, true, "unit-test");
    syncPipEnabled(runtime, true, "unit-test:unchanged");

    expect(pipPatch).toHaveBeenCalledTimes(1);
    expect(emittedEvents).toEqual([
      {
        target: globalThis,
        eventKey: "PipStatusChanged",
        ownerDomain: "pip",
        payload: {
          enabled: true,
          changedKeys: ["enabled"],
        },
      },
    ]);
  });

  test("own PiP開始と終了で表示とstreamを同期すること", async () => {
    const { runtime, pipStreamStart, pipStreamStop, pipVideoElement } = createRuntime(true);
    const video = createHiddenElement<HTMLVideoElement>();
    const commentsCanvas = createHiddenElement<HTMLCanvasElement>();
    const exitFullscreen = vi.fn(async () => undefined);
    runtime.sourceVideoElement = video;
    runtime.sourceCommentsCanvas = commentsCanvas;
    setGlobalProperty("document", {
      fullscreenElement: createHiddenElement<HTMLElement>(),
      exitFullscreen,
    } satisfies Pick<Document, "fullscreenElement" | "exitFullscreen">);

    syncOwnPipPresentation(runtime, true, "unit-test:enter");
    await Promise.resolve();

    expect(requestExitBrowserSizeFullscreenForOwnPipEnterMock).toHaveBeenCalledWith(runtime, "unit-test:enter");
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(pipStreamStart).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.hidden).toBe(false);
    expect(video.hidden).toBe(true);
    expect(commentsCanvas.hidden).toBe(true);

    syncOwnPipPresentation(runtime, false, "unit-test:leave");

    expect(pipStreamStop).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.hidden).toBe(true);
    expect(video.hidden).toBe(false);
    expect(commentsCanvas.hidden).toBe(false);
    expect(runtime.hiddenSourceElements.size).toBe(0);
  });
});
