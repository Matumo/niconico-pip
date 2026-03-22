/**
 * mainブラウザスモークテスト
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
import type { BrowserLogCollector } from "@test/shared/browser/browser-log-collector";

const watchPageFixturePath = resolve(__dirname, "../fixtures/watch-page.html");

const findConsoleLogIndex = (
  logCollector: BrowserLogCollector,
  text: string,
): number => logCollector.entries.findIndex(
  (entry) => entry.source === "console" && entry.text.includes(text),
);

test.describe("main", () => {
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

  test("fixtureページで拡張機能content scriptが起動完了すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("watchページ初回起動でelements初回同期とpage -> status連鎖が観測できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }
    const session = await environment.createSession();

    try {
      const watchPageFixtureHtml = await readFile(watchPageFixturePath, "utf8");
      const watchUrl = "https://www.nicovideo.jp/watch/sm9";

      await session.context.route("https://www.nicovideo.jp/watch/*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: watchPageFixtureHtml,
        });
      });

      await session.page.goto(watchUrl);
      await expectBrowserConsoleLogContaining(session.logCollector, "elements updated:");
      await expectBrowserConsoleLogContaining(session.logCollector, `page url changed: ${watchUrl}`);
      await expectBrowserConsoleLogContaining(session.logCollector, "video info updated (trigger=page-url-changed)");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const elementsInitialStartLogIndex = findConsoleLogIndex(
        session.logCollector,
        "elements updated:"
      );
      const pageUrlChangedLogIndex = findConsoleLogIndex(session.logCollector, `page url changed: ${watchUrl}`);
      const videoInfoUpdatedLogIndex = findConsoleLogIndex(
        session.logCollector,
        "video info updated (trigger=page-url-changed)",
      );
      const bootstrapCompletedLogIndex = findConsoleLogIndex(session.logCollector, "bootstrap completed");

      expect(elementsInitialStartLogIndex).toBeGreaterThanOrEqual(0);
      expect(pageUrlChangedLogIndex).toBeGreaterThan(elementsInitialStartLogIndex);
      expect(videoInfoUpdatedLogIndex).toBeGreaterThan(pageUrlChangedLogIndex);
      expect(bootstrapCompletedLogIndex).toBeGreaterThan(videoInfoUpdatedLogIndex);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
