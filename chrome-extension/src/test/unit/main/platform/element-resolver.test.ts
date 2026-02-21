/**
 * 要素リゾルバーテスト
 */
import { describe, expect, test } from "vitest";
import { createElementResolver, type QueryRoot } from "@main/platform/element-resolver";
import { selectorDefinitions } from "@main/config/selector";
import { createMockLogger } from "@test/unit/main/helpers/logger";

// テスト用要素型
type FakeElement = Element & {
  tagName: string;
  isConnected: boolean;
};

// テスト用要素を作成する関数
const createFakeElement = (tagName: string): FakeElement =>
  ({
    tagName,
    isConnected: true,
  } as unknown as FakeElement);

describe("要素リゾルバー", () => {
  test("primaryで解決してキャッシュを利用すること", () => {
    const video = createFakeElement("VIDEO");
    const videoPrimarySelector = selectorDefinitions.video.primary;
    let queryCount = 0;

    const root: QueryRoot = {
      querySelector: (selector: string): Element | null => {
        queryCount += 1;
        if (selector === videoPrimarySelector) {
          return video;
        }
        return null;
      },
    };

    const logger = createMockLogger("test-resolver");

    let generation = 1;
    const resolver = createElementResolver({
      root,
      logger,
      getPageGeneration: () => generation,
    });

    const first = resolver.resolve("video");
    const second = resolver.resolve("video");

    expect(first).toBe(video);
    expect(second).toBe(video);
    expect(queryCount).toBe(1);

    generation = 2;
    resolver.resolve("video");
    expect(queryCount).toBe(2);
  });

  test("全セレクタでguard不一致を除外すること", () => {
    const alwaysMismatchedTagName = "TEST_GUARD_MISMATCH";
    const root: QueryRoot = {
      querySelector: (): Element | null => createFakeElement(alwaysMismatchedTagName),
    };

    const logger = createMockLogger("test-resolver");

    const resolver = createElementResolver({
      root,
      logger,
      getPageGeneration: () => 1,
    });

    const selectorKeys = Object.keys(selectorDefinitions) as Array<keyof typeof selectorDefinitions>;
    for (const key of selectorKeys) {
      expect(resolver.resolve(key)).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(`Selector guard rejected element for key=${key}`, {
        selector: expect.any(String),
      });
    }

    const expectedWarnCount = selectorKeys.reduce(
      (count, key) => count + 1 + selectorDefinitions[key].fallbacks.length,
      0,
    );
    expect(logger.warn).toHaveBeenCalledTimes(expectedWarnCount);
  });

  test("validate不一致を除外し、キャッシュ時にも再検証すること", () => {
    const video = createFakeElement("VIDEO");
    const logger = createMockLogger("test-resolver");
    let isValid = false;

    const resolver = createElementResolver({
      root: {
        querySelector: () => video,
      },
      logger,
      getPageGeneration: () => 1,
      definitions: {
        ...selectorDefinitions,
        video: {
          ...selectorDefinitions.video,
          validate: () => isValid,
        },
      },
    });

    expect(resolver.resolve("video")).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith("Selector validate rejected element for key=video", {
      selector: selectorDefinitions.video.primary,
    });

    isValid = true;
    expect(resolver.resolve("video")).toBe(video);

    isValid = false;
    expect(resolver.peek("video")).toBeNull();
  });

  test("invalidateでキャッシュを破棄できること", () => {
    const video = createFakeElement("VIDEO");

    const root: QueryRoot = {
      querySelector: () => video,
    };

    const resolver = createElementResolver({
      root,
      logger: createMockLogger("test-resolver"),
      getPageGeneration: () => 1,
    });

    expect(resolver.resolve("video")).toBe(video);
    resolver.invalidate("video");
    expect(resolver.peek("video")).toBeNull();

    resolver.resolve("video");
    resolver.invalidateAll();
    expect(resolver.peek("video")).toBeNull();
  });
});
