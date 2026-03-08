/**
 * pipドメインブラウザテスト
 */
import { expect, test, type Page } from "@playwright/test";
import { createAppConfig } from "@main/config/config";
import {
  expectBrowserConsoleLogContaining,
  expectNoBrowserConsoleWarnings,
  expectNoBrowserPageErrors,
} from "@test/shared/browser/browser-log-assertions";
import {
  startExtensionFixtureEnvironment,
  type ExtensionFixtureEnvironment,
} from "@test/browser-headless/shared/extension-fixture-environment";
import { executeHeadlessRuntimeTest } from "@test/browser-headless/shared/runtime-test/headless-bridge-client";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";

interface AppPageUrlChangedDetails {
  url: string;
  generation: number;
  isWatchPage: boolean;
}

interface AppVideoInfoChangedDetails {
  title: string | null;
  author: string | null;
  thumbnail: string | null;
  pageGeneration: number;
  infoGeneration: number;
}

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
const runtimeTestPath = runtimeTestPathMap.main.domain.pipTest;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";
const playerContainerSelector = String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`;
const fullscreenToggleButtonSelector =
  `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示する"], ` +
  `button[data-scope="tooltip"][data-part="trigger"][aria-label="全画面表示を終了"]`;

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

const emitPageUrlChanged = async (
  page: Page,
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

const emitWatchPageUrlChanged = async (page: Page): Promise<void> => {
  await emitPageUrlChanged(page, {
    url: "https://www.nicovideo.jp/watch/sm9",
    generation: Date.now(),
    isWatchPage: true,
  });
};

const emitVideoInfoChanged = async (
  page: Page,
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

const initPipRuntime = async (page: Page): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "init",
    },
  });
  expect(result.ok).toBe(true);
};

const resetPipRuntime = async (page: Page): Promise<void> => {
  await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "reset",
    },
  }).catch(() => undefined);
};

const expectNoNewPipStatusChanged = async (page: Page): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "checkNoEvent",
    },
  });
  expect(result.ok).toBe(true);
};

const waitForPipStatusChanged = async (
  page: Page,
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

const dispatchNativePipEvent = async (
  page: Page,
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

const simulateForeignPipTakeover = async (page: Page): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "simulateForeignPipTakeover",
    },
  });
  expect(result.ok).toBe(true);
};

const verifyForeignEnterInFlightGuard = async (page: Page): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "verifyForeignEnterInFlightGuard",
    },
  });
  expect(result.ok).toBe(true);
};

const expectNativePipEventSequence = async (
  page: Page,
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

const clickFullscreenToggleButton = async (page: Page): Promise<void> => {
  await page.locator(fullscreenToggleButtonSelector).click();
};

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

const waitForPipElementInserted = async (page: Page): Promise<void> => {
  await expect.poll(async () => {
    const pipView = await readPipVideoElementView(page);
    return pipView.exists && pipView.parentFirstChildId === config.pipVideoElementId;
  }).toBe(true);
};

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

test.describe("pipドメイン", () => {
  let environment: ExtensionFixtureEnvironment | null = null;

  test.beforeAll(async () => {
    environment = await startExtensionFixtureEnvironment();
  });

  test.afterAll(async () => {
    if (environment) {
      await environment.close();
      environment = null;
    }
  });

  test("watch遷移でPiP要素を挿入しサイズ追従とposter更新ができること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });

        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists && pipView.parentFirstChildId === config.pipVideoElementId &&
                 pipView.width === "640px" && pipView.height === "360px";
        }).toBe(true);

        await setPlayerContainerSize(session.page, 320, 180);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.width === "320px" && pipView.height === "180px";
        }).toBe(true);

        await emitVideoInfoChanged(session.page, {
          title: "watch title",
          author: "watch author",
          thumbnail: tinyPngDataUrl,
          pageGeneration: Date.now(),
          infoGeneration: Date.now(),
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return typeof pipView.poster === "string" && pipView.poster.length > 0;
        }).toBe(true);

        await expectNoNewPipStatusChanged(session.page);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("non-watch遷移ではPipStatusChangedを発火しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/ranking",
          generation: Date.now(),
          isWatchPage: false,
        });

        await expectNoNewPipStatusChanged(session.page);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("PiPネイティブ実イベントに追従してPipStatusChangedを通知すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, true);

        await dispatchNativePipEvent(session.page, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, false);

        await expectNoNewPipStatusChanged(session.page);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("leave要求が連続しても2回目以降は追加通知しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, true);

        await dispatchNativePipEvent(session.page, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, false);

        await dispatchNativePipEvent(session.page, "leavepictureinpicture", "window");
        await expectNoNewPipStatusChanged(session.page);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("own PiPの開始と終了でsource hiddenとPiP要素表示が同期すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page);
        await waitForPipElementInserted(session.page);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });

        await dispatchNativePipEvent(session.page, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, true);
        await waitForPipPresentationState(session.page, {
          pipHidden: false,
          sourceVideoHidden: true,
          commentsCanvasHidden: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.activePictureInPictureElementId === config.pipVideoElementId;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, false);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("watch再遷移でplayerContainer再解決後にPiP要素が新しい配置先の先頭へ移動し重複しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page);
        await waitForPipElementInserted(session.page);

        await replacePlayerContainerWithPreexistingChild(session.page, 320, 180);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return !pipView.exists && pipView.pipElementCount === 0;
        }).toBe(true);
        await emitWatchPageUrlChanged(session.page);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists &&
            pipView.parentMarker === "replacement-player-container" &&
            pipView.parentFirstChildId === config.pipVideoElementId &&
            pipView.nextElementSiblingMarker === "preexisting-first-child" &&
            pipView.pipElementCount === 1 &&
            pipView.width === "320px" &&
            pipView.height === "180px";
        }).toBe(true);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("browser-size fullscreenトグルクリックでown PiPを終了しsource hiddenを復帰すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page);
        await waitForPipElementInserted(session.page);

        await dispatchNativePipEvent(session.page, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, true);
        await waitForPipPresentationState(session.page, {
          pipHidden: false,
          sourceVideoHidden: true,
          commentsCanvasHidden: true,
        });

        await clickFullscreenToggleButton(session.page);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.fullscreenToggleAriaLabel === "全画面表示を終了";
        }).toBe(true);
        await waitForPipStatusChanged(session.page, false);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("own PiP中にnon-watchへ遷移したら実APIでPiP終了と要素解除を行うこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page);
        await waitForPipElementInserted(session.page);

        await dispatchNativePipEvent(session.page, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, true);
        await waitForPipPresentationState(session.page, {
          pipHidden: false,
          sourceVideoHidden: true,
          commentsCanvasHidden: true,
        });

        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/ranking",
          generation: Date.now(),
          isWatchPage: false,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return !pipView.exists &&
            pipView.pipElementCount === 0 &&
            pipView.activePictureInPictureElementId === null &&
            pipView.sourceVideoHidden === false &&
            pipView.commentsCanvasHidden === false;
        }).toBe(true);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("foreign PiP開始時に実イベントでleave後に拡張PiPのenterへ切り替わること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await simulateForeignPipTakeover(session.page);
        await waitForPipStatusChanged(session.page, true);
        await expectNativePipEventSequence(session.page, [
          "enterpictureinpicture:videoElement",
          "leavepictureinpicture:videoElement",
          "enterpictureinpicture:pipVideoElement",
        ]);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("foreign PiPが連続しても拡張PiP再要求はin-flight中に多重実行しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await verifyForeignEnterInFlightGuard(session.page);
      } finally {
        await resetPipRuntime(session.page);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
