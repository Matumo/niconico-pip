/**
 * 要素リゾルバーテスト
 */
import { describe, expect, test } from "vitest";
import { createElementResolver, type QueryRoot } from "@main/platform/element-resolver";
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
    let queryCount = 0;

    const root: QueryRoot = {
      querySelector: (selector: string): Element | null => {
        queryCount += 1;
        if (selector === '[data-name="content"] > video') {
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

  test("fallbackを評価してguard不一致を除外すること", () => {
    const root: QueryRoot = {
      querySelector: (selector: string): Element | null => {
        if (selector === 'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを非表示にする"]') {
          return createFakeElement("DIV");
        }
        if (selector === 'button[data-scope="tooltip"][data-part="trigger"][aria-label="コメントを表示する"]') {
          return createFakeElement("BUTTON");
        }
        return null;
      },
    };

    const logger = createMockLogger("test-resolver");

    const resolver = createElementResolver({
      root,
      logger,
      getPageGeneration: () => 1,
    });

    const resolved = resolver.resolve("tooltipButton");

    expect(resolved?.tagName).toBe("BUTTON");
    expect(logger.warn).toHaveBeenCalledTimes(1);
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
