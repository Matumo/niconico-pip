/**
 * PiP動画要素 poster変換アダプターブラウザテスト
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
import { executeHeadlessRuntimeTest } from "@test/browser-headless/shared/runtime-test/headless-bridge-client";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";

test.describe("PiP動画要素 poster変換アダプター", () => {
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
      const result = await executeHeadlessRuntimeTest(
        session.page,
        runtimeTestPathMap.main.adapter.media.pipVideoElementPosterTest,
      );
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

      const result = await executeHeadlessRuntimeTest(
        session.page,
        runtimeTestPathMap.main.adapter.media.pipVideoElementPosterTest,
        {
          details: {
            checkOfflineFailure: true,
          },
        },
      );
      expect(result.ok).toBe(true);
    } finally {
      await session.context.setOffline(false);
      await session.close();
    }
  });
});
