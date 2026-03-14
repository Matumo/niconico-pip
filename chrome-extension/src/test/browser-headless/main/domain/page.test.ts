/**
 * pageドメインブラウザテスト
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getLogger } from "@matumo/ts-simple-logger";
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
import type { BrowserLogCollector } from "@test/shared/browser/browser-log-collector";

const log = getLogger("test");
const watchPageFixturePath = resolve(__dirname, "../../fixtures/watch-page.html");
const nonWatchPageFixturePath = resolve(__dirname, "../../fixtures/non-watch-page.html");

const createPageUrlChangedLogText = (url: string): string =>
  `page url changed: ${url} (trigger=mutation-observer)`;

const logCurrentUrl = (phase: string, page: Page): void => {
  log.info(`${phase}: current url = ${page.url()} (fixture only; no real site access)`);
};

const countPageUrlChangedLogs = (logCollector: BrowserLogCollector, url: string): number => {
  const text = createPageUrlChangedLogText(url);
  return logCollector.entries.filter(
    (entry) => entry.source === "console" && entry.text.includes(text),
  ).length;
};

const mutateHead = async (page: Page, markerName: string): Promise<void> => {
  await page.evaluate((name) => {
    const marker = globalThis.document.createElement("meta");
    marker.name = name;
    marker.content = name;
    globalThis.document.head.appendChild(marker);
  }, markerName);
};

const expectNoPageUrlChangedLogWithin = async (
  page: Page,
  url: string,
  timeoutMs = 120,
): Promise<void> => {
  const text = createPageUrlChangedLogText(url);
  await expect(
    page.waitForEvent("console", {
      predicate: (message) => message.text().includes(text),
      timeout: timeoutMs,
    }),
  ).rejects.toThrow();
};

test.describe("pageドメイン", () => {
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

  test("ブラウザでURL変更監視が動作すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      const nonWatchPageFixtureHtml = await readFile(nonWatchPageFixturePath, "utf8");
      await session.context.route("https://www.nicovideo.jp/ranking*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: nonWatchPageFixtureHtml,
        });
      });

      const initialNonWatchUrl = "https://www.nicovideo.jp/ranking";
      await session.page.goto(initialNonWatchUrl);
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const runtimeTestPath = runtimeTestPathMap.main.domain.pageTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        const initialUrl = session.page.url();
        const nextPath = "/ranking?browser-headless-next";
        const nextUrl = new URL(nextPath, "https://www.nicovideo.jp").toString();

        // pushStateでは検知しないことを確認
        logCurrentUrl("[1] pushState", session.page);
        const pushStateTargetCountBefore = countPageUrlChangedLogs(session.logCollector, nextUrl);
        await session.page.evaluate((path) => {
          globalThis.history.pushState({ browserHeadlessTest: true }, "", path);
        }, nextPath);
        await expectNoPageUrlChangedLogWithin(session.page, nextUrl);
        expect(countPageUrlChangedLogs(session.logCollector, nextUrl)).toBe(pushStateTargetCountBefore);
        const pushStateNoEventResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNoEvent",
              expectedUrl: nextUrl,
            },
          },
        );
        expect(pushStateNoEventResult.ok).toBe(true);
        logCurrentUrl("[1] pushState", session.page);

        // mutation-observerで検知することを確認
        logCurrentUrl("[2] mutation-observer", session.page);
        await mutateHead(session.page, "after-push-state");
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, nextUrl))
          .toBe(pushStateTargetCountBefore + 1);
        const pushStateMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: nextUrl,
              expectedIsWatchPage: false,
            },
          },
        );
        expect(pushStateMutationResult.ok).toBe(true);
        logCurrentUrl("[2] mutation-observer", session.page);

        // goBackでは検知しないことを確認
        logCurrentUrl("[3] goBack", session.page);
        const goBackTargetCountBefore = countPageUrlChangedLogs(session.logCollector, initialUrl);
        await session.page.goBack();
        await expectNoPageUrlChangedLogWithin(session.page, initialUrl);
        expect(countPageUrlChangedLogs(session.logCollector, initialUrl)).toBe(goBackTargetCountBefore);
        const goBackNoEventResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNoEvent",
              expectedUrl: initialUrl,
            },
          },
        );
        expect(goBackNoEventResult.ok).toBe(true);
        logCurrentUrl("[3] goBack", session.page);

        // goBack後のmutation-observerで検知することを確認
        logCurrentUrl("[4] mutation-observer", session.page);
        await mutateHead(session.page, "after-go-back");
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, initialUrl))
          .toBe(goBackTargetCountBefore + 1);
        const goBackMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: initialUrl,
              expectedIsWatchPage: false,
            },
          },
        );
        expect(goBackMutationResult.ok).toBe(true);
        logCurrentUrl("[4] mutation-observer", session.page);

        // goForwardでは検知しないことを確認
        logCurrentUrl("[5] goForward", session.page);
        const goForwardTargetCountBefore = countPageUrlChangedLogs(session.logCollector, nextUrl);
        await session.page.goForward();
        await expectNoPageUrlChangedLogWithin(session.page, nextUrl);
        expect(countPageUrlChangedLogs(session.logCollector, nextUrl)).toBe(goForwardTargetCountBefore);
        const goForwardNoEventResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNoEvent",
              expectedUrl: nextUrl,
            },
          },
        );
        expect(goForwardNoEventResult.ok).toBe(true);
        logCurrentUrl("[5] goForward", session.page);

        // goForward後のmutation-observerで検知することを確認
        logCurrentUrl("[6] mutation-observer", session.page);
        await mutateHead(session.page, "after-go-forward");
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, nextUrl))
          .toBe(goForwardTargetCountBefore + 1);
        const goForwardMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: nextUrl,
              expectedIsWatchPage: false,
            },
          },
        );
        expect(goForwardMutationResult.ok).toBe(true);
        logCurrentUrl("[6] mutation-observer", session.page);
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

  test("watch URL変更時はisWatchPage=trueを通知すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      const watchPageFixtureHtml = await readFile(watchPageFixturePath, "utf8");
      await session.context.route("https://www.nicovideo.jp/watch/*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: watchPageFixtureHtml,
        });
      });

      const initialWatchUrl = "https://www.nicovideo.jp/watch/sm9";
      await session.page.goto(initialWatchUrl);
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.pageTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        const nextWatchPath = "/watch/sm10?browser-headless-next";
        const nextWatchUrl = new URL(nextWatchPath, "https://www.nicovideo.jp").toString();

        // pushStateでは検知しないことを確認
        const pushStateTargetCountBefore = countPageUrlChangedLogs(session.logCollector, nextWatchUrl);
        await session.page.evaluate((path) => {
          globalThis.history.pushState({ browserHeadlessTest: true }, "", path);
        }, nextWatchPath);
        await expectNoPageUrlChangedLogWithin(session.page, nextWatchUrl);
        expect(countPageUrlChangedLogs(session.logCollector, nextWatchUrl)).toBe(pushStateTargetCountBefore);
        const pushStateNoEventResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNoEvent",
              expectedUrl: nextWatchUrl,
            },
          },
        );
        expect(pushStateNoEventResult.ok).toBe(true);

        // mutation-observerで検知し、isWatchPage=trueで通知することを確認
        await mutateHead(session.page, "watch-after-push-state");
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, nextWatchUrl))
          .toBe(pushStateTargetCountBefore + 1);
        const pushStateMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: nextWatchUrl,
              expectedIsWatchPage: true,
            },
          },
        );
        expect(pushStateMutationResult.ok).toBe(true);

        // goBack後のmutation-observerでもisWatchPage=trueを維持することを確認
        const goBackTargetCountBefore = countPageUrlChangedLogs(session.logCollector, initialWatchUrl);
        await session.page.goBack();
        await expectNoPageUrlChangedLogWithin(session.page, initialWatchUrl);
        expect(countPageUrlChangedLogs(session.logCollector, initialWatchUrl)).toBe(goBackTargetCountBefore);
        const goBackNoEventResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNoEvent",
              expectedUrl: initialWatchUrl,
            },
          },
        );
        expect(goBackNoEventResult.ok).toBe(true);

        await mutateHead(session.page, "watch-after-go-back");
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, initialWatchUrl))
          .toBe(goBackTargetCountBefore + 1);
        const goBackMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: initialWatchUrl,
              expectedIsWatchPage: true,
            },
          },
        );
        expect(goBackMutationResult.ok).toBe(true);
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
