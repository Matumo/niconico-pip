/**
 * pipドメインブラウザテスト
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
  config,
  emitPageUrlChanged,
  emitVideoInfoChanged,
  expectNoNewPipStatusChanged,
  initPipRuntime,
  readPipVideoElementView,
  replacePlayerContainerWithPreexistingChild,
  resetPipRuntime,
  setPlayerContainerSize,
  tinyPngDataUrl,
} from "@test/browser-headless/main/domain/pip/pip-browser-test-helper";

const runtimeTestPath = runtimeTestPathMap.main.domain.pipTest;
let pageGeneration = 0;

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
          return pipView.exists &&
            pipView.parentFirstChildId === config.pipVideoElementId &&
            pipView.width === "640px" &&
            pipView.height === "360px";
        }).toBe(true);

        await setPlayerContainerSize(session.page, 320, 180);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return pipView.width === "320px" && pipView.height === "180px";
        }).toBe(true);

        await emitVideoInfoChanged(session.page, runtimeTestPath, {
          title: "watch title",
          author: "watch author",
          thumbnail: tinyPngDataUrl,
          pageGeneration: ++pageGeneration,
          infoGeneration: ++pageGeneration,
        });
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return typeof pipView.poster === "string" && pipView.poster.length > 0;
        }).toBe(true);

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

  test("non-watch遷移ではPipStatusChangedを発火しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await initPipRuntime(session.page, runtimeTestPath);

      try {
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/ranking",
          generation: ++pageGeneration,
          isWatchPage: false,
        });

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

  test("watch再遷移でplayerContainer再解決後にPiP要素が新しい配置先の先頭へ移動し重複しないこと", async () => {
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

        await replacePlayerContainerWithPreexistingChild(session.page, 320, 180);
        await expect.poll(async () => {
          const pipView = await readPipVideoElementView(session.page);
          return !pipView.exists && pipView.pipElementCount === 0;
        }).toBe(true);

        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: ++pageGeneration,
          isWatchPage: true,
        });
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
        await resetPipRuntime(session.page, runtimeTestPath);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
