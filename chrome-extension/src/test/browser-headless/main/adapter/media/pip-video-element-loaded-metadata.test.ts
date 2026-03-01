/**
 * PiP動画要素 loadedmetadata待機アダプターブラウザテスト
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

test.describe("PiP動画要素 loadedmetadata待機アダプター", () => {
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

  test("ブラウザでloadedmetadata待機が動作すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
      const result = await executeHeadlessRuntimeTest(
        session.page,
        runtimeTestPathMap.main.adapter.media.pipVideoElementLoadedMetadataTest,
      );
      expect(result.ok).toBe(true);
      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
