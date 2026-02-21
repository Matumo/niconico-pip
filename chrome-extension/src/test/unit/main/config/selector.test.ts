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
// 文字列をアルファベット順に比較する関数
const compareAlphabetically = (left: string, right: string): number => left.localeCompare(right);

describe("セレクタ定義", () => {
  test("必須キー分の定義を持つこと", () => {
    expect(Object.keys(selectorDefinitions).sort(compareAlphabetically)).toEqual([
      "commentsCanvas",
      "playerContainer",
      "playerMenu",
      "tooltipButton",
      "video",
    ]);
  });

  test("各定義が有効なselector文字列を持つこと", () => {
    for (const definition of Object.values(selectorDefinitions)) {
      expect(typeof definition.primary).toBe("string");
      expect(definition.primary.trim()).not.toBe("");
      expect(Array.isArray(definition.fallbacks)).toBe(true);
      for (const fallback of definition.fallbacks) {
        expect(typeof fallback).toBe("string");
        expect(fallback.trim()).not.toBe("");
      }
    }
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

  test("validateが定義されbooleanを返すこと", () => {
    const button = fakeElement("BUTTON") as HTMLButtonElement;
    expect(selectorDefinitions.tooltipButton.validate(button)).toBe(true);
  });

  test("テスト用要素ヘルパーが利用できること", () => {
    const element = fakeElement("BUTTON") as FakeElement;
    expect(element.tagName).toBe("BUTTON");
  });
});
