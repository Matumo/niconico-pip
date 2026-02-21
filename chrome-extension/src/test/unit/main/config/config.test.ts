/**
 * configテスト
 */
import { describe, expect, test } from "vitest";
import { createAppConfig } from "@main/config/config";

describe("config", () => {
  test("既定設定が契約どおりの形で返ること", () => {
    const config = createAppConfig();

    // 型チェック
    expect(config).toMatchObject({
      appName: expect.any(String),
      prefixId: expect.any(String),
      shouldUseDebugLog: expect.any(Boolean),
      watchPageUrlPattern: expect.any(RegExp),
      pipButtonElementId: expect.any(String),
      pipVideoElementId: expect.any(String),
      videoPipCanvasHeight: expect.any(Number),
      videoPipCanvasWidth: expect.any(Number),
      pipButtonOnMouseOverColor: expect.any(String),
      pipButtonOnMouseOutColor: expect.any(String),
      seekBackwardDefaultOffset: expect.any(Number),
      seekForwardDefaultOffset: expect.any(Number),
    });

    // 値パターン確認
    expect(config.pipButtonElementId).toBe(`${config.prefixId}-elem-pip-button`);
    expect(config.pipVideoElementId).toBe(`${config.prefixId}-elem-pip-video`);
    expect(config.watchPageUrlPattern.test("https://www.nicovideo.jp/watch/sm9")).toBe(true);
    expect(config.watchPageUrlPattern.test("https://www.nicovideo.jp/mylist/1")).toBe(false);
    expect(config.appName.trim()).not.toBe("");
    expect(config.prefixId.trim()).not.toBe("");
    expect(config.pipButtonOnMouseOverColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(config.pipButtonOnMouseOutColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(config.videoPipCanvasHeight).toBeGreaterThan(0);
    expect(config.videoPipCanvasWidth).toBeGreaterThan(0);
    expect(config.seekBackwardDefaultOffset).toBeGreaterThan(0);
    expect(config.seekForwardDefaultOffset).toBeGreaterThan(0);
  });

  test("上書き設定を適用すること", () => {
    const baseConfig = createAppConfig();
    const overrides = {
      shouldUseDebugLog: true,
      appName: "custom-app",
    };
    const config = createAppConfig(overrides);

    expect(config).toEqual({
      ...baseConfig,
      ...overrides,
    });
    expect(config.prefixId).toBe(baseConfig.prefixId);
  });
});
