/**
 * PiPレンダラーブラウザテスト
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  pipRendererScenarioMarkerMap,
  pipRendererTestScenarios,
  type PipRendererTestScenario,
} from "@test/browser-headless/main/adapter/media/pip-renderer.test-scenario";
import {
  expectBrowserConsoleLogContaining,
  expectNoBrowserConsoleWarnings,
  expectNoBrowserPageErrors,
} from "@test/shared/browser/browser-log-assertions";
import {
  startExtensionFixtureEnvironment,
  type ExtensionFixtureEnvironment,
} from "@test/browser-headless/shared/extension-fixture-environment";
import {
  executeHeadlessRuntimeTest,
  type ExecuteHeadlessRuntimeTestResult,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-client";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";

const attachRendererSnapshot = async (
  page: Page,
  testInfo: TestInfo,
  scenario: PipRendererTestScenario,
): Promise<void> => {
  const marker = pipRendererScenarioMarkerMap[scenario];
  const snapshot = page.locator(`[data-niconico-pip-marker="${marker}"]`);
  if (await snapshot.count() === 0) return;

  const outputPath = testInfo.outputPath(`${marker}.png`);
  await snapshot.first().screenshot({ path: outputPath });
  await testInfo.attach(`${marker}.png`, {
    path: outputPath,
    contentType: "image/png",
  });
};

test.describe("PiPレンダラー", () => {
  let environment: ExtensionFixtureEnvironment | null = null;

  test.beforeAll(async () => {
    environment = await startExtensionFixtureEnvironment({
      defaultDocumentPath: "/empty.html",
    });
  });

  test.afterAll(async () => {
    if (environment) {
      await environment.close();
      environment = null;
    }
  });

  for (const scenario of pipRendererTestScenarios) {
    test(`ブラウザで ${scenario} を描画できること`, async ({ page: _ }, testInfo) => {
      if (!environment) {
        throw new Error("Extension fixture environment is not initialized");
      }

      const session = await environment.createSession();

      try {
        await session.goto("/empty.html");
        await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");
        let result: ExecuteHeadlessRuntimeTestResult | null = null;
        try {
          result = await executeHeadlessRuntimeTest(
            session.page,
            runtimeTestPathMap.main.adapter.media.pipRendererTest,
            {
              timeoutMs: 10000,
              details: { scenario },
            },
          );
        } finally {
          await attachRendererSnapshot(session.page, testInfo, scenario);
        }
        if (!result) {
          throw new Error("PiP renderer runtime test did not produce a result");
        }
        expect(result.ok).toBe(true);
        expectNoBrowserConsoleWarnings(session.logCollector);
        expectNoBrowserPageErrors(session.logCollector);
      } finally {
        await session.close();
      }
    });
  }
});
