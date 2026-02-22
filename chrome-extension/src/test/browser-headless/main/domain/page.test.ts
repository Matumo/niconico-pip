/**
 * pageドメインブラウザテスト
 */
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

const createPageUrlChangedLogText = (url: string): string =>
  `page url changed: ${url} (trigger=mutation-observer)`;

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
    marker.content = String(Date.now());
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
      await session.goto("/");
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
        const origin = new URL(initialUrl).origin;
        const nextPath = `?browser-headless-${Date.now()}`;
        const nextUrl = new URL(nextPath, origin).toString();

        // pushStateでは検知しないことを確認
        log.info(`[1] pushState: current url = ${session.page.url()}`);
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
        log.info(`[1] pushState: current url = ${session.page.url()}`);

        // mutation-observerで検知することを確認
        log.info(`[2] mutation-observer: current url = ${session.page.url()}`);
        await mutateHead(session.page, `after-push-state-${Date.now()}`);
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, nextUrl))
          .toBe(pushStateTargetCountBefore + 1);
        const pushStateMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: nextUrl,
            },
          },
        );
        expect(pushStateMutationResult.ok).toBe(true);
        log.info(`[2] mutation-observer: current url = ${session.page.url()}`);

        // goBackでは検知しないことを確認
        log.info(`[3] goBack: current url = ${session.page.url()}`);
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
        log.info(`[3] goBack: current url = ${session.page.url()}`);

        // goBack後のmutation-observerで検知することを確認
        log.info(`[4] mutation-observer: current url = ${session.page.url()}`);
        await mutateHead(session.page, `after-go-back-${Date.now()}`);
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, initialUrl))
          .toBe(goBackTargetCountBefore + 1);
        const goBackMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: initialUrl,
            },
          },
        );
        expect(goBackMutationResult.ok).toBe(true);
        log.info(`[4] mutation-observer: current url = ${session.page.url()}`);

        // goForwardでは検知しないことを確認
        log.info(`[5] goForward: current url = ${session.page.url()}`);
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
        log.info(`[5] goForward: current url = ${session.page.url()}`);

        // goForward後のmutation-observerで検知することを確認
        log.info(`[6] mutation-observer: current url = ${session.page.url()}`);
        await mutateHead(session.page, `after-go-forward-${Date.now()}`);
        await expect.poll(() => countPageUrlChangedLogs(session.logCollector, nextUrl))
          .toBe(goForwardTargetCountBefore + 1);
        const goForwardMutationResult = await executeHeadlessRuntimeTest(
          session.page,
          runtimeTestPath,
          {
            details: {
              command: "checkNewEvent",
              expectedUrl: nextUrl,
            },
          },
        );
        expect(goForwardMutationResult.ok).toBe(true);
        log.info(`[6] mutation-observer: current url = ${session.page.url()}`);
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
