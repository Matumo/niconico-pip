/**
 * elementsドメインブラウザテスト
 */
import { expect, test, type Page } from "@playwright/test";
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

const appendHeadMarker = async (page: Page, markerName: string): Promise<void> => {
  await page.evaluate((name) => {
    const marker = globalThis.document.createElement("meta");
    marker.name = name;
    marker.content = String(Date.now());
    globalThis.document.head.appendChild(marker);
  }, markerName);
};

const removePlayerMenu = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const playerMenu = globalThis.document.querySelector("div[data-scope='menu']");
    if (playerMenu instanceof HTMLElement) {
      playerMenu.remove();
    }
  });
};

const appendDiscoverWrapper = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const discoverTarget = globalThis.document.querySelector("body > #root main")
      ?? globalThis.document.querySelector("body > #root")
      ?? globalThis.document.body;
    if (!(discoverTarget instanceof HTMLElement)) {
      throw new TypeError("discover target is not found");
    }

    const existingWrapper = Array.from(discoverTarget.children).find((child) =>
      child instanceof HTMLElement && child.dataset.testRole === "discover-wrapper");
    if (existingWrapper instanceof HTMLElement) return;

    const wrapper = globalThis.document.createElement("div");
    wrapper.dataset.testRole = "discover-wrapper";
    discoverTarget.appendChild(wrapper);
  });
};

const snapshotPlayerAreaHtml = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const playerArea = globalThis.document.querySelector(String.raw`div.grid-area_\[player\]`);
    if (!(playerArea instanceof HTMLElement)) {
      throw new TypeError("player area is not found");
    }
    return playerArea.outerHTML;
  });

const appendSnapshotPlayerAreaToDiscoverWrapper = async (
  page: Page,
  playerAreaHtmlSnapshot: string,
): Promise<void> => {
  await page.evaluate((snapshotHtml) => {
    const wrapper = globalThis.document.querySelector(String.raw`[data-test-role="discover-wrapper"]`);
    if (!(wrapper instanceof HTMLElement)) {
      throw new TypeError("discover wrapper is not found");
    }

    const existingPlayerArea = wrapper.querySelector(String.raw`div.grid-area_\[player\]`);
    if (existingPlayerArea instanceof HTMLElement) return;

    const template = globalThis.document.createElement("template");
    template.innerHTML = snapshotHtml.trim();
    const snapshotPlayerArea = template.content.firstElementChild;
    if (!(snapshotPlayerArea instanceof HTMLElement)) {
      throw new TypeError("snapshot player area is invalid");
    }
    wrapper.appendChild(snapshotPlayerArea);
  }, playerAreaHtmlSnapshot);
};

const snapshotPlayerMenuHtml = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const playerMenu = globalThis.document.querySelector(String.raw`div[data-scope="menu"]`);
    if (!(playerMenu instanceof HTMLElement)) {
      throw new TypeError("player menu is not found");
    }
    return playerMenu.outerHTML;
  });

const appendSnapshotPlayerMenu = async (
  page: Page,
  playerMenuHtmlSnapshot: string,
): Promise<void> => {
  await page.evaluate((snapshotHtml) => {
    const playerContainer = globalThis.document.querySelector(
      String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`,
    );
    if (!(playerContainer instanceof HTMLElement)) {
      throw new TypeError("playerContainer is not found");
    }

    const existingPlayerMenu = Array.from(playerContainer.children).find((child) =>
      child instanceof HTMLElement && child.dataset.scope === "menu");
    if (existingPlayerMenu instanceof HTMLElement) return;

    const template = globalThis.document.createElement("template");
    template.innerHTML = snapshotHtml.trim();
    const snapshotPlayerMenu = template.content.firstElementChild;
    if (!(snapshotPlayerMenu instanceof HTMLElement)) {
      throw new TypeError("snapshot player menu is invalid");
    }
    playerContainer.appendChild(snapshotPlayerMenu);
  }, playerMenuHtmlSnapshot);
};

const wrapPlayerMenuUnderContainerDescendant = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const playerContainer = globalThis.document.querySelector(
      String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`,
    );
    if (!(playerContainer instanceof HTMLElement)) {
      throw new TypeError("playerContainer is not found");
    }

    const directChildren = Array.from(playerContainer.children);
    const existingWrapper = directChildren.find((child) =>
      child instanceof HTMLElement && child.dataset.testRole === "menu-wrapper");
    if (existingWrapper instanceof HTMLElement) return;

    const directPlayerMenu = directChildren.find((child) =>
      child instanceof HTMLElement && child.dataset.scope === "menu");
    if (!(directPlayerMenu instanceof HTMLElement)) {
      throw new TypeError("direct playerMenu is not found");
    }

    const wrapper = globalThis.document.createElement("div");
    wrapper.dataset.testRole = "menu-wrapper";
    directPlayerMenu.replaceWith(wrapper);
    wrapper.appendChild(directPlayerMenu);
  });
};

const replaceNestedPlayerMenu = async (
  page: Page,
  playerMenuHtmlSnapshot: string,
): Promise<void> => {
  await page.evaluate((snapshotHtml) => {
    const playerContainer = globalThis.document.querySelector(
      String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`,
    );
    if (!(playerContainer instanceof HTMLElement)) {
      throw new TypeError("playerContainer is not found");
    }

    const wrapper = Array.from(playerContainer.children).find((child) =>
      child instanceof HTMLElement && child.dataset.testRole === "menu-wrapper");
    if (!(wrapper instanceof HTMLElement)) {
      throw new TypeError("menu wrapper is not found");
    }

    const currentPlayerMenu = Array.from(wrapper.children).find((child) =>
      child instanceof HTMLElement && child.dataset.scope === "menu");
    if (!(currentPlayerMenu instanceof HTMLElement)) {
      throw new TypeError("current playerMenu is not found");
    }

    const template = globalThis.document.createElement("template");
    template.innerHTML = snapshotHtml.trim();
    const nextPlayerMenu = template.content.firstElementChild;
    if (!(nextPlayerMenu instanceof HTMLElement)) {
      throw new TypeError("snapshot player menu is invalid");
    }
    currentPlayerMenu.replaceWith(nextPlayerMenu);
  }, playerMenuHtmlSnapshot);
};

const pulsePlayerContainerChildListMutation = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const playerContainer = globalThis.document.querySelector(
      String.raw`div.grid-area_\[player\] > div.PlayerPresenter > div > div`,
    );
    if (!(playerContainer instanceof HTMLElement)) {
      throw new TypeError("playerContainer is not found");
    }

    const pulseNode = globalThis.document.createElement("div");
    pulseNode.dataset.testRole = "observer-pulse";
    playerContainer.appendChild(pulseNode);
    pulseNode.remove();
  });
};

interface AppPageUrlChangedDetails {
  url: string;
  generation: number;
  isWatchPage: boolean;
}

const expectedPrimaryElementKeys = [
  "commentToggleButton",
  "playerContainer",
  "playerMenu",
  "video",
  "commentsCanvas",
] as const;

const emitPageUrlChanged = async (
  page: Page,
  runtimeTestPath: string,
  details: AppPageUrlChangedDetails,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "emitPageUrlChanged",
      url: details.url,
      generation: details.generation,
      isWatchPage: details.isWatchPage,
    },
  });
  expect(result.ok).toBe(true);
};

const waitForElementsUpdated = async (
  page: Page,
  runtimeTestPath: string,
  expectedChangedKeys: string[],
): Promise<void> => {
  await expect.poll(async () => {
    const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
      details: {
        command: "checkNewEvent",
        expectedChangedKeys,
      },
    });
    return result.ok;
  }).toBe(true);
};

const expectNoNewElementsEvent = async (page: Page, runtimeTestPath: string): Promise<void> => {
  const noEventResult = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "checkNoEvent",
    },
  });
  expect(noEventResult.ok).toBe(true);
};

const enterWatchPageMode = async (page: Page, runtimeTestPath: string): Promise<void> => {
  await emitPageUrlChanged(page, runtimeTestPath, {
    url: "https://www.nicovideo.jp/watch/sm9",
    generation: Date.now(),
    isWatchPage: true,
  });
  await waitForElementsUpdated(page, runtimeTestPath, [...expectedPrimaryElementKeys]);
};

test.describe("elementsドメイン", () => {
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

  test("要素欠落時もfail-softで継続し再追加時に再同期できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.elementsTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        await enterWatchPageMode(session.page, runtimeTestPath);

        const playerMenuHtmlSnapshot = await snapshotPlayerMenuHtml(session.page);

        // head側のmutationではelements更新イベントが増えないことを確認
        await appendHeadMarker(session.page, `elements-head-${Date.now()}`);
        await expectNoNewElementsEvent(session.page, runtimeTestPath);

        // NOTE: discover監視で探すplayerContainerは [data-scope="menu"] を含む前提で解決される。
        // menuを外すとplayerContainerも未解決になり、watch-playerからdiscover監視へ戻る。
        // その結果、必須要素の欠落イベントが通知されることを確認する。
        await removePlayerMenu(session.page);
        await waitForElementsUpdated(session.page, runtimeTestPath, [...expectedPrimaryElementKeys]);

        // playerメニューを戻した後にwatchページ遷移イベントを与えると再同期イベントが発火する
        await appendSnapshotPlayerMenu(session.page, playerMenuHtmlSnapshot);
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await waitForElementsUpdated(session.page, runtimeTestPath, [...expectedPrimaryElementKeys]);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("URL変更なしでもplayer直下変化をトリガーにsubtree差し替えを再評価できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await wrapPlayerMenuUnderContainerDescendant(session.page);

      const runtimeTestPath = runtimeTestPathMap.main.domain.elementsTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        await enterWatchPageMode(session.page, runtimeTestPath);

        const playerMenuHtmlSnapshot = await snapshotPlayerMenuHtml(session.page);

        // サブツリー更新だけではwatch-playerの監視対象外で再評価が走らないことを確認
        await replaceNestedPlayerMenu(session.page, playerMenuHtmlSnapshot);
        await expectNoNewElementsEvent(session.page, runtimeTestPath);

        // playerContainer直下のchildList変化を与えると再評価されることを確認
        await pulsePlayerContainerChildListMutation(session.page);
        await waitForElementsUpdated(session.page, runtimeTestPath, [
          "commentToggleButton",
          "playerMenu",
          "video",
          "commentsCanvas",
        ]);

        // 差分なしの追加トリガーではElementsUpdatedが増えないことを確認
        await pulsePlayerContainerChildListMutation(session.page);
        await expectNoNewElementsEvent(session.page, runtimeTestPath);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("discover監視中は孫要素として追加されたplayerも再検知できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.elementsTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        await enterWatchPageMode(session.page, runtimeTestPath);

        const playerAreaHtmlSnapshot = await snapshotPlayerAreaHtml(session.page);

        // NOTE: menuを外すとdiscover監視で探すplayerContainerのセレクタ条件を満たせなくなり、
        // elementsはplayer監視を解除してdiscover監視へ戻る。
        await removePlayerMenu(session.page);
        await waitForElementsUpdated(session.page, runtimeTestPath, [...expectedPrimaryElementKeys]);

        // discover監視対象の直下へwrapperのみ追加した時点では要素解決が変化しないことを確認
        await appendDiscoverWrapper(session.page);
        await expectNoNewElementsEvent(session.page, runtimeTestPath);

        // wrapper配下（孫要素）へplayer領域を追加して再検知できることを確認
        await appendSnapshotPlayerAreaToDiscoverWrapper(session.page, playerAreaHtmlSnapshot);
        await waitForElementsUpdated(session.page, runtimeTestPath, [...expectedPrimaryElementKeys]);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("PageUrlChanged(isWatchPage=false)で空スナップショット通知後に監視停止すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.elementsTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        await enterWatchPageMode(session.page, runtimeTestPath);

        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/ranking",
          generation: Date.now() + 1,
          isWatchPage: false,
        });
        await waitForElementsUpdated(session.page, runtimeTestPath, [...expectedPrimaryElementKeys]);

        await removePlayerMenu(session.page);
        await expectNoNewElementsEvent(session.page, runtimeTestPath);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
