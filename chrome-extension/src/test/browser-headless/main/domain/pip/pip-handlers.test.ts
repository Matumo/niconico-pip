/**
 * pip-handlersブラウザテスト
 */
import { expect, test } from "@playwright/test";
import {
  expectBrowserConsoleLogContaining,
  expectNoBrowserConsoleWarnings,
  expectNoBrowserPageErrors,
} from "@test/shared/browser/browser-log-assertions";
import {
  startExtensionFixtureEnvironment,
  type ExtensionFixtureEnvironment,
} from "@test/browser-headless/shared/extension-fixture-environment";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";
import {
  clickFullscreenToggleButton,
  config,
  dispatchNativePipEvent,
  emitPageUrlChanged,
  emitWatchPageUrlChanged,
  expectNativePipEventSequence,
  expectNoNewPipStatusChanged,
  initPipRuntime,
  readPipVideoElementView,
  resetPipRuntime,
  setPlayerContainerSize,
  simulateForeignPipTakeover,
  verifyForeignEnterInFlightGuard,
  waitForPipElementInserted,
  waitForPipPresentationState,
  waitForPipStatusChanged,
} from "./pip-browser-test-helper";

const runtimeTestPath = runtimeTestPathMap.main.domain.pip.pipHandlersTest;
let pageGeneration = 0;

test.describe("pip-handlers", () => {
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

  test("PiPネイティブ実イベントに追従してPipStatusChangedを通知すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: ++pageGeneration,
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, runtimeTestPath, false);

        await expectNoNewPipStatusChanged(session.page, runtimeTestPath);
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: ++pageGeneration,
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, runtimeTestPath, false);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "leavepictureinpicture", "window");
        await expectNoNewPipStatusChanged(session.page, runtimeTestPath);
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page, runtimeTestPath);
        await waitForPipElementInserted(session.page);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });

        await dispatchNativePipEvent(session.page, runtimeTestPath, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);
        await waitForPipPresentationState(session.page, {
          pipHidden: false,
          sourceVideoHidden: true,
          commentsCanvasHidden: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.activePictureInPictureElementId === config.pipVideoElementId;
        }).toBe(true);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "leavepictureinpicture", "window");
        await waitForPipStatusChanged(session.page, runtimeTestPath, false);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page, runtimeTestPath);
        await waitForPipElementInserted(session.page);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);
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
        await waitForPipStatusChanged(session.page, runtimeTestPath, false);
        await waitForPipPresentationState(session.page, {
          pipHidden: true,
          sourceVideoHidden: false,
          commentsCanvasHidden: false,
        });
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitWatchPageUrlChanged(session.page, runtimeTestPath);
        await waitForPipElementInserted(session.page);

        await dispatchNativePipEvent(session.page, runtimeTestPath, "enterpictureinpicture", "pipVideoElement");
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);
        await waitForPipPresentationState(session.page, {
          pipHidden: false,
          sourceVideoHidden: true,
          commentsCanvasHidden: true,
        });

        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/ranking",
          generation: ++pageGeneration,
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
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: ++pageGeneration,
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await simulateForeignPipTakeover(session.page, runtimeTestPath);
        await waitForPipStatusChanged(session.page, runtimeTestPath, true);
        await expectNativePipEventSequence(session.page, runtimeTestPath, [
          "enterpictureinpicture:videoElement",
          "leavepictureinpicture:videoElement",
          "enterpictureinpicture:pipVideoElement",
        ]);
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
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
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await setPlayerContainerSize(session.page, 640, 360);
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: ++pageGeneration,
          isWatchPage: true,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.exists;
        }).toBe(true);

        await verifyForeignEnterInFlightGuard(session.page, runtimeTestPath);
      } finally {
        await resetPipRuntime(session.page, runtimeTestPath);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
