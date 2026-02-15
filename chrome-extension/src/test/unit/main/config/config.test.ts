/**
 * configテスト
 */
import { describe, expect, test } from "vitest";
import { createAppConfig } from "@main/config/config";

describe("config", () => {
  test("既定設定を返すこと", () => {
    expect(createAppConfig()).toEqual({
      appName: "niconico-pip",
      prefixId: "com-matumo-dev-niconico-pip",
      watchPageUrlPattern: /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/,
      shouldUseDebugLog: false,
    });
  });

  test("上書き設定を適用すること", () => {
    const baseConfig = createAppConfig();
    const config = createAppConfig({
      shouldUseDebugLog: true,
      appName: "custom-app",
    });

    expect(config.shouldUseDebugLog).toBe(true);
    expect(config.appName).toBe("custom-app");
    expect(config.prefixId).toBe(baseConfig.prefixId);
  });
});
