/**
 * pip表示同期のブラウザランタイムテスト
 */
import type { AppEventMap } from "@main/config/event";
import type { PipDomainRuntime } from "@main/domain/pip/pip-runtime";
import {
  syncOwnPipPresentation,
  syncPipEnabled,
  syncSourceVisibilityForPipEnabled,
  updateRendererSources,
} from "@main/domain/pip/pip-presentation";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

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

const createRuntime = (): {
  runtime: PipDomainRuntime;
  emittedEvents: Array<{
    eventKey: string;
    payload: unknown;
    target: EventTarget;
  }>;
  pipVideoElement: HTMLVideoElement;
  pipStreamStartCount: () => number;
  pipStreamStopCount: () => number;
  rendererSetSourcesCalls: Array<unknown>;
} => {
  const emittedEvents: Array<{
    eventKey: string;
    payload: unknown;
    target: EventTarget;
  }> = [];
  const rendererSetSourcesCalls: Array<unknown> = [];
  let pipEnabled = false;
  let startCount = 0;
  let stopCount = 0;
  const pipVideoElement = globalThis.document.createElement("video");
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
        patch: (partial: { enabled?: boolean }) => {
          if (typeof partial.enabled === "boolean") pipEnabled = partial.enabled;
        },
      },
    },
    pipVideoElementAdapter: {
      getElement: () => pipVideoElement,
    },
    pipRenderer: {
      setSources: (value: unknown) => {
        rendererSetSourcesCalls.push(value);
      },
    },
    pipStream: {
      start: () => {
        startCount += 1;
        return true;
      },
      stop: () => {
        stopCount += 1;
      },
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
    pipVideoElement,
    pipStreamStartCount: () => startCount,
    pipStreamStopCount: () => stopCount,
    rendererSetSourcesCalls,
  };
};

const runTest = (): HeadlessBridgeDetails => {
  const {
    runtime,
    emittedEvents,
    pipVideoElement,
    pipStreamStartCount,
    pipStreamStopCount,
    rendererSetSourcesCalls,
  } = createRuntime();
  const previousHidden = globalThis.document.createElement("div");
  const video = globalThis.document.createElement("video");
  const commentsCanvas = globalThis.document.createElement("canvas");
  previousHidden.hidden = true;
  runtime.hiddenSourceElements.add(previousHidden);

  updateRendererSources(runtime, createEmptySnapshot({
    video,
    commentsCanvas,
  }));
  const rendererSourcesUpdated = runtime.sourceVideoElement === video &&
    runtime.sourceCommentsCanvas === commentsCanvas &&
    rendererSetSourcesCalls.length === 1;

  syncSourceVisibilityForPipEnabled(runtime);
  const hiddenSyncWorked = Boolean(previousHidden.hidden) === false &&
    video.hidden === true &&
    commentsCanvas.hidden === true &&
    runtime.hiddenSourceElements.has(video) &&
    runtime.hiddenSourceElements.has(commentsCanvas);

  syncOwnPipPresentation(runtime, true, "browser-runtime:enter");
  const enterSynced = pipStreamStartCount() === 1 &&
    pipVideoElement.hidden === false &&
    video.hidden === true &&
    commentsCanvas.hidden === true;

  syncOwnPipPresentation(runtime, false, "browser-runtime:leave");
  const leaveSynced = pipStreamStopCount() === 1 &&
    pipVideoElement.hidden === true &&
    video.hidden === false &&
    commentsCanvas.hidden === false &&
    runtime.hiddenSourceElements.size === 0;

  syncPipEnabled(runtime, true, "browser-runtime:status");
  syncPipEnabled(runtime, true, "browser-runtime:status-unchanged");
  const pipEnabledEventEmittedOnce = emittedEvents.length === 1 &&
    emittedEvents[0]?.target === globalThis &&
    emittedEvents[0]?.eventKey === "PipStatusChanged" &&
    JSON.stringify(emittedEvents[0]?.payload) === JSON.stringify({
      enabled: true,
      changedKeys: ["enabled"],
    });

  return {
    rendererSourcesUpdated,
    hiddenSyncWorked,
    enterSynced,
    leaveSynced,
    pipEnabledEventEmittedOnce,
  };
};

// エクスポート
export { runTest };
