/**
 * configテスト
 */
import { afterEach, describe, expect, test, vi } from "vitest";

type DebugGlobal = typeof globalThis & {
  __APP_DEBUG__?: boolean;
};

const setAppDebug = (value: boolean | undefined): void => {
  const globalWithDebug = globalThis as DebugGlobal;

  if (value === undefined) {
    delete globalWithDebug.__APP_DEBUG__;
    return;
  }

  globalWithDebug.__APP_DEBUG__ = value;
};

const loadCreateAppConfig = async () => {
  vi.resetModules();
  const configModule = await import("@main/config/config");
  return configModule.createAppConfig;
};

afterEach(() => {
  setAppDebug(undefined);
  vi.resetModules();
});

describe("config", () => {
  test("既定設定が契約どおりの形で返ること", async () => {
    const createAppConfig = await loadCreateAppConfig();
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

  test("上書き設定を適用すること", async () => {
    const createAppConfig = await loadCreateAppConfig();
    const baseConfig = createAppConfig();
    const overrides = {
      appName: "custom-app",
    };
    const config = createAppConfig(overrides);

    expect(config).toEqual({
      ...baseConfig,
      ...overrides,
    });
    expect(config.prefixId).toBe(baseConfig.prefixId);
  });

  test("既定では shouldUseDebugLog が false であること", async () => {
    const createAppConfig = await loadCreateAppConfig();
    const config = createAppConfig();

    expect(config.shouldUseDebugLog).toBe(false);
  });

  test("__APP_DEBUG__ が true のとき shouldUseDebugLog が true であること", async () => {
    setAppDebug(true);
    const createAppConfig = await loadCreateAppConfig();
    const config = createAppConfig();

    expect(config.shouldUseDebugLog).toBe(true);
  });
});
