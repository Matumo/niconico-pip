/**
 * セレクタ設定テスト
 */
import { describe, expect, test } from "vitest";
import { selectorDefinitions } from "@main/config/selector";

// テスト用要素型
type FakeElement = {
  tagName: string;
};

// テスト用のElementを作成する関数
const fakeElement = (tagName: string): Element => ({
  tagName,
} as unknown as Element);

describe("セレクタ定義", () => {
  test("v1基準のprimaryセレクタを含むこと", () => {
    expect(selectorDefinitions.video.primary).toContain('[data-name="content"] > video');
    expect(selectorDefinitions.commentsCanvas.primary).toContain('div[data-name="comment"] > canvas');
  });

  test("guardがタグ名で厳密判定すること", () => {
    const video = fakeElement("VIDEO");
    const div = fakeElement("DIV");
    const button = fakeElement("BUTTON");
    const canvas = fakeElement("CANVAS");

    expect(selectorDefinitions.video.guard(video)).toBe(true);
    expect(selectorDefinitions.video.guard(div)).toBe(false);
    expect(selectorDefinitions.playerContainer.guard(div)).toBe(true);
    expect(selectorDefinitions.tooltipButton.guard(button)).toBe(true);
    expect(selectorDefinitions.commentsCanvas.guard(canvas)).toBe(true);
  });

  test("fallbackが定義されていること", () => {
    expect(selectorDefinitions.tooltipButton.fallbacks.length).toBeGreaterThan(0);
  });

  test("テスト用要素ヘルパーが利用できること", () => {
    const element = fakeElement("BUTTON") as FakeElement;
    expect(element.tagName).toBe("BUTTON");
  });
});
