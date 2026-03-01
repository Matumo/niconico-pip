/**
 * PiP動画要素サイズ計算テスト
 */
import { describe, expect, test } from "vitest";
import { calculatePipVideoElementSize } from "@main/adapter/media/pip-video-element-size";

describe("PiP動画要素サイズ計算", () => {
  test("親サイズの小数は切り捨てて計算すること", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 640.9,
      parentHeight: 360.9,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 640,
      height: 360,
    });
  });

  test("横幅基準で収まる場合は比率維持でサイズを返すこと", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 640,
      parentHeight: 360,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 640,
      height: 360,
    });
  });

  test("高さ基準で収まる場合はwide分岐と偶数補正を適用すること", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 800,
      parentHeight: 300,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 534,
      height: 300,
    });
  });

  test("分岐境界の等値比率でもサイズを正しく返すこと", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 160,
      parentHeight: 90,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 160,
      height: 90,
    });
  });

  test("偶数補正で親サイズを超える場合は2px戻して収めること", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 99,
      parentHeight: 300,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 98,
      height: 56,
    });
  });

  test("高さ側でも偶数補正後に親サイズ超過を補正すること", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 800,
      parentHeight: 101,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 180,
      height: 100,
    });
  });

  test("親サイズが極小でも計算が破綻しないこと", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 1,
      parentHeight: 1,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 1,
      height: 0,
    });
  });

  test("親幅が0以下でも最小幅1で計算すること", () => {
    const size = calculatePipVideoElementSize({
      parentWidth: 0,
      parentHeight: 300,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(size).toEqual({
      width: 1,
      height: 0,
    });
  });
});
