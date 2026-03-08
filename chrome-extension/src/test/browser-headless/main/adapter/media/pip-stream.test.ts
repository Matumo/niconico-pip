/**
 * PiPストリームブラウザテスト
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
import type { BrowserLogCollector } from "@test/shared/browser/browser-log-collector";
import type { PipStreamTestScenario } from "@test/browser-headless/main/adapter/media/pip-stream.test-scenario";

const resolveConsoleWarnings = (collector: BrowserLogCollector) =>
  collector.entries.filter(
    (entry) => entry.source === "console" && (entry.level === "warning" || entry.level === "warn"),
  );

const executePipStreamRuntimeTest = (
  page: Page,
  scenario: PipStreamTestScenario,
) => executeHeadlessRuntimeTest(
  page,
  runtimeTestPathMap.main.adapter.media.pipStreamTest,
  {
    details: { scenario },
  },
);

test.describe("PiPストリーム", () => {
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

  test("ブラウザでPiPストリームが動作すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/empty.html");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipStreamRuntimeTest(session.page, "lifecycle");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("ブラウザでrenderFrame例外後も描画ループを継続すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/empty.html");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipStreamRuntimeTest(session.page, "renderFrameThrows");
      expect(result.ok).toBe(true);
      await expectBrowserConsoleLogContaining(session.logCollector, "pip stream renderFrame failed");
      const consoleWarnings = resolveConsoleWarnings(session.logCollector);
      expect(consoleWarnings.length).toBeGreaterThan(0);
      expect(consoleWarnings.every((entry) => entry.text.includes("pip stream renderFrame failed"))).toBe(true);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
