/**
 * pipドメインbrowser-headlessテストhelper
 */
import { expect, type Page } from "@playwright/test";
import { createAppConfig } from "@main/config/config";
import { executeHeadlessRuntimeTest } from "@test/browser-headless/shared/runtime-test/headless-bridge-client";

// PageUrlChanged詳細型
interface AppPageUrlChangedDetails {
  url: string;
  generation: number;
  isWatchPage: boolean;
}

// VideoInfoChanged詳細型
interface AppVideoInfoChangedDetails {
  title: string | null;
  author: string | null;
  thumbnail: string | null;
  pageGeneration: number;
  infoGeneration: number;
}

// PiP動画要素の観測結果型
interface PipVideoElementView {
  exists: boolean;
  activePictureInPictureElementId: string | null;
  parentFirstChildId: string | null;
  parentMarker: string | null;
  nextElementSiblingMarker: string | null;
  pipElementCount: number;
  hidden: boolean | null;
  sourceVideoHidden: boolean | null;
  commentsCanvasHidden: boolean | null;
  fullscreenToggleAriaLabel: string | null;
  width: string | null;
  height: string | null;
  poster: string | null;
}

const config = createAppConfig();
const tinyPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";
const playerContainerSelector = String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`;
const fullscreenToggleButtonSelector =
  `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示する"], ` +
  `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示を終了"]`;
let pageUrlGeneration = 0;

// playerContainerサイズを変更する関数
const setPlayerContainerSize = async (
  page: Page,
  width: number,
  height: number,
): Promise<void> => {
  await page.evaluate(({ nextWidth, nextHeight, selector }) => {
    const playerContainer = globalThis.document.querySelector(selector);
    if (!(playerContainer instanceof HTMLElement)) {
      throw new TypeError("playerContainer is not found");
    }

    playerContainer.style.width = `${nextWidth}px`;
    playerContainer.style.height = `${nextHeight}px`;
    playerContainer.style.display = "block";
  }, {
    nextWidth: width,
    nextHeight: height,
    selector: playerContainerSelector,
  });
};

// playerContainerを差し替えて既存先頭子要素を持つ状態を再現する関数
const replacePlayerContainerWithPreexistingChild = async (
  page: Page,
  width: number,
  height: number,
): Promise<void> => {
  await page.evaluate(({ nextWidth, nextHeight, pipVideoElementId, selector }) => {
    const playerContainer = globalThis.document.querySelector(selector);
    if (!(playerContainer instanceof HTMLDivElement)) {
      throw new TypeError("playerContainer is not found");
    }

    const playerMenu = Array.from(playerContainer.children).find((child) =>
      child instanceof HTMLElement && child.dataset.scope === "menu");
    if (!(playerMenu instanceof HTMLDivElement)) {
      throw new TypeError("playerMenu is not found");
    }

    const replacement = globalThis.document.createElement("div");
    replacement.dataset.niconicoPipMarker = "replacement-player-container";
    replacement.style.display = "block";
    replacement.style.width = `${nextWidth}px`;
    replacement.style.height = `${nextHeight}px`;

    const sentinel = globalThis.document.createElement("div");
    sentinel.dataset.niconicoPipMarker = "preexisting-first-child";
    replacement.appendChild(sentinel);

    const clonedPlayerMenu = playerMenu.cloneNode(true);
    if (!(clonedPlayerMenu instanceof HTMLDivElement)) {
      throw new TypeError("playerMenu clone failed");
    }
    replacement.appendChild(clonedPlayerMenu);

    if (!(playerContainer.parentElement instanceof HTMLElement)) {
      throw new TypeError("playerContainer parent is not found");
    }

    playerContainer.replaceWith(replacement);

    const duplicatePipNodes = globalThis.document.querySelectorAll(`#${pipVideoElementId}`);
    if (duplicatePipNodes.length > 1) {
      throw new TypeError("duplicate PiP video elements detected while replacing playerContainer");
    }
  }, {
    nextWidth: width,
    nextHeight: height,
    pipVideoElementId: config.pipVideoElementId,
    selector: playerContainerSelector,
  });
};

// PageUrlChangedを送出する関数
const emitPageUrlChanged = async (
  page: Page,
  runtimeTestPath: string,
  details: AppPageUrlChangedDetails,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "emitPageUrlChanged",
      ...details,
    },
  });
  expect(result.ok).toBe(true);
};

// watchページ用PageUrlChangedを送出する関数
const emitWatchPageUrlChanged = async (
  page: Page,
  runtimeTestPath: string,
): Promise<void> => {
  await emitPageUrlChanged(page, runtimeTestPath, {
    url: "https://www.nicovideo.jp/watch/sm9",
    generation: ++pageUrlGeneration,
    isWatchPage: true,
  });
};

// VideoInfoChangedを送出する関数
const emitVideoInfoChanged = async (
  page: Page,
  runtimeTestPath: string,
  details: AppVideoInfoChangedDetails,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "emitVideoInfoChanged",
      ...details,
    },
  });
  expect(result.ok).toBe(true);
};

// pipランタイム収集を初期化する関数
const initPipRuntime = async (page: Page, runtimeTestPath: string): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "init",
    },
  });
  expect(result.ok).toBe(true);
};

// pipランタイム収集を破棄する関数
const resetPipRuntime = async (page: Page, runtimeTestPath: string): Promise<void> => {
  await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "reset",
    },
  }).catch(() => undefined);
};

// PipStatusChangedの新規発火がないことを確認する関数
const expectNoNewPipStatusChanged = async (
  page: Page,
  runtimeTestPath: string,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "checkNoEvent",
    },
  });
  expect(result.ok).toBe(true);
};

// PipStatusChangedが期待値で発火するまで待機する関数
const waitForPipStatusChanged = async (
  page: Page,
  runtimeTestPath: string,
  expectedEnabled: boolean,
): Promise<void> => {
  await expect.poll(async () => {
    const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
      details: {
        command: "checkNewEvent",
        expectedEnabled,
      },
    });
    return result.ok;
  }).toBe(true);
};

// native PiPイベントを実APIで発火する関数
const dispatchNativePipEvent = async (
  page: Page,
  runtimeTestPath: string,
  eventType: "enterpictureinpicture" | "leavepictureinpicture",
  targetKind: "window" | "pipVideoElement",
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "dispatchNativePipEvent",
      eventType,
      targetKind,
    },
  });
  expect(result.ok).toBe(true);
  expect(result.details.realApiUsed).toBe(true);
  expect(result.details.realApiCombinationSupported).not.toBe(false);
};

// foreign PiP奪取シナリオを実行する関数
const simulateForeignPipTakeover = async (
  page: Page,
  runtimeTestPath: string,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "simulateForeignPipTakeover",
    },
  });
  expect(result.ok).toBe(true);
};

// foreign PiP連続検知時のin-flight抑止を確認する関数
const verifyForeignEnterInFlightGuard = async (
  page: Page,
  runtimeTestPath: string,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "verifyForeignEnterInFlightGuard",
    },
  });
  expect(result.ok).toBe(true);
};

// native PiPイベント列を確認する関数
const expectNativePipEventSequence = async (
  page: Page,
  runtimeTestPath: string,
  expectedSequence: readonly string[],
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "checkNewNativePipEventSequence",
      expectedSequence: [...expectedSequence],
    },
  });
  expect(result.ok).toBe(true);
};

// fullscreenトグルを押下する関数
const clickFullscreenToggleButton = async (page: Page): Promise<void> => {
  await page.locator(fullscreenToggleButtonSelector).click();
};

// 現在のPiP動画要素表示状態を取得する関数
const readPipVideoElementView = async (page: Page): Promise<PipVideoElementView> =>
  page.evaluate((pipVideoElementId) => {
    const pipVideoElement = globalThis.document.getElementById(pipVideoElementId);
    const sourceVideoElement = globalThis.document.querySelector(`[data-name="content"] > video`);
    const commentsCanvas = globalThis.document.querySelector(`div[data-name="comment"] > canvas`);
    const fullscreenToggleButton = globalThis.document.querySelector(
      `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示する"], ` +
      `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示を終了"]`,
    );
    if (!(pipVideoElement instanceof HTMLVideoElement)) {
      return {
        exists: false,
        activePictureInPictureElementId: globalThis.document.pictureInPictureElement?.id ?? null,
        parentFirstChildId: null,
        parentMarker: null,
        nextElementSiblingMarker: null,
        pipElementCount: globalThis.document.querySelectorAll(`#${pipVideoElementId}`).length,
        hidden: null,
        sourceVideoHidden: sourceVideoElement instanceof HTMLVideoElement ? sourceVideoElement.hidden : null,
        commentsCanvasHidden: commentsCanvas instanceof HTMLCanvasElement ? commentsCanvas.hidden : null,
        fullscreenToggleAriaLabel: fullscreenToggleButton instanceof HTMLButtonElement ?
          fullscreenToggleButton.getAttribute("aria-label") : null,
        width: null,
        height: null,
        poster: null,
      };
    }

    return {
      exists: true,
      activePictureInPictureElementId: globalThis.document.pictureInPictureElement?.id ?? null,
      parentFirstChildId: pipVideoElement.parentElement?.firstElementChild?.id ?? null,
      parentMarker: pipVideoElement.parentElement?.dataset.niconicoPipMarker ?? null,
      nextElementSiblingMarker: pipVideoElement.nextElementSibling instanceof HTMLElement
        ? pipVideoElement.nextElementSibling.dataset.niconicoPipMarker ?? null : null,
      pipElementCount: globalThis.document.querySelectorAll(`#${pipVideoElementId}`).length,
      hidden: pipVideoElement.hidden,
      sourceVideoHidden: sourceVideoElement instanceof HTMLVideoElement ? sourceVideoElement.hidden : null,
      commentsCanvasHidden: commentsCanvas instanceof HTMLCanvasElement ? commentsCanvas.hidden : null,
      fullscreenToggleAriaLabel: fullscreenToggleButton instanceof HTMLButtonElement ?
        fullscreenToggleButton.getAttribute("aria-label") : null,
      width: pipVideoElement.style.width || null,
      height: pipVideoElement.style.height || null,
      poster: pipVideoElement.getAttribute("poster"),
    };
  }, config.pipVideoElementId);

// PiP動画要素が配置された状態まで待機する関数
const waitForPipElementInserted = async (page: Page): Promise<void> => {
  await expect.poll(async () => {
    const pipView = await readPipVideoElementView(page);
    return pipView.exists && pipView.parentFirstChildId === config.pipVideoElementId;
  }).toBe(true);
};

// PiP表示状態が期待値へ揃うまで待機する関数
const waitForPipPresentationState = async (
  page: Page,
  expected: {
    pipHidden: boolean;
    sourceVideoHidden: boolean;
    commentsCanvasHidden: boolean;
  },
): Promise<void> => {
  await expect.poll(async () => {
    const pipView = await readPipVideoElementView(page);
    return pipView.hidden === expected.pipHidden &&
      pipView.sourceVideoHidden === expected.sourceVideoHidden &&
      pipView.commentsCanvasHidden === expected.commentsCanvasHidden;
  }).toBe(true);
};

// エクスポート
export {
  clickFullscreenToggleButton,
  config,
  dispatchNativePipEvent,
  emitPageUrlChanged,
  emitVideoInfoChanged,
  emitWatchPageUrlChanged,
  expectNativePipEventSequence,
  expectNoNewPipStatusChanged,
  initPipRuntime,
  readPipVideoElementView,
  replacePlayerContainerWithPreexistingChild,
  resetPipRuntime,
  setPlayerContainerSize,
  simulateForeignPipTakeover,
  tinyPngDataUrl,
  verifyForeignEnterInFlightGuard,
  waitForPipElementInserted,
  waitForPipPresentationState,
  waitForPipStatusChanged,
};
export type {
  AppPageUrlChangedDetails,
  AppVideoInfoChangedDetails,
  PipVideoElementView,
};
