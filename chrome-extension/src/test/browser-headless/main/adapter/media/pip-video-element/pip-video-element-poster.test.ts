/**
 * PiP動画要素 poster変換アダプターブラウザテスト
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
import type { PipVideoElementPosterTestScenario } from "@test/browser-headless/main/adapter/media/pip-video-element/pip-video-element-poster.test-scenario";

const executePipVideoElementPosterRuntimeTest = (
  page: Page,
  scenario: PipVideoElementPosterTestScenario,
) => executeHeadlessRuntimeTest(
  page,
  runtimeTestPathMap.main.adapter.media.pipVideoElement.pipVideoElementPosterTest,
  {
    details: {
      scenario,
    },
  },
);

test.describe("PiP動画要素poster変換アダプター", () => {
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

  test("ブラウザでposter変換が動作すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipVideoElementPosterRuntimeTest(session.page, "basic");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("ブラウザがオフラインでもURL画像の取得失敗を検知できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      await session.context.setOffline(true);

      const result = await executePipVideoElementPosterRuntimeTest(session.page, "offlineFailure");
      expect(result.ok).toBe(true);
    } finally {
      await session.context.setOffline(false);
      await session.close();
    }
  });

  test("ブラウザでkeyパラメーターだけ異なるURLでもcache hitすること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipVideoElementPosterRuntimeTest(session.page, "keyNormalizationCacheHit");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("ブラウザで同時実行時に進行中Promiseを共有して重複変換しないこと", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipVideoElementPosterRuntimeTest(session.page, "sharedPendingPromise");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("ブラウザで変換失敗後はcacheから外れて再試行できること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipVideoElementPosterRuntimeTest(session.page, "retryAfterFailure");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("ブラウザでposter出力が16:9へ変換されること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executePipVideoElementPosterRuntimeTest(session.page, "outputIs16By9");
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
