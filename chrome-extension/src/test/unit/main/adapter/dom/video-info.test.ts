/**
 * 動画情報取得アダプターテスト
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createVideoInfoAdapter } from "@main/adapter/dom/video-info";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

// テストで差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["document", "HTMLScriptElement"] as const;

// script要素テストダブル
class FakeScriptElement {
  textContent: string | null = null;
}

// FakeScriptElementのコンストラクタ型
type FakeScriptElementConstructor = new () => FakeScriptElement;

// querySelectorAll戻り値用のNodeList風配列を作る関数
const createNodeList = (elements: Element[]): NodeListOf<Element> =>
  elements as unknown as NodeListOf<Element>;

// テスト用script要素を作る関数
const createScript = (text: string | null): Element => {
  const ScriptCtor = globalThis.HTMLScriptElement as unknown as FakeScriptElementConstructor;
  const script = new ScriptCtor();
  script.textContent = text;
  return script as unknown as Element;
};

// 想定JSON-LD形式のVideoObjectを作る関数
const createAssumedVideoObjectJsonLd = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  "@type": "VideoObject",
  name: "テスト用ダミー動画",
  thumbnail: [
    {
      "@type": "ImageObject",
      url: "https://example.test/thumbnails/sm9/original.jpg",
    },
  ],
  thumbnailUrl: [
    "https://example.test/thumbnails/sm9/original.jpg",
  ],
  author: {
    "@type": "Person",
    name: "Test User",
  },
  ...overrides,
});

describe("動画情報取得アダプター", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    setGlobalProperty("HTMLScriptElement", FakeScriptElement);
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("document未定義時は空スナップショットを返すこと", () => {
    setGlobalProperty("document", undefined);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: null,
      author: null,
      thumbnail: null,
    });
  });

  test("querySelectorAll未対応document時は空スナップショットを返すこと", () => {
    setGlobalProperty("document", {} as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: null,
      author: null,
      thumbnail: null,
    });
  });

  test("無効JSONをスキップしてVideoObjectを抽出できること", () => {
    const notScriptElement = { textContent: "{\"@type\":\"VideoObject\"}" } as unknown as Element;
    const invalidScript = createScript("{");
    const validScript = createScript(JSON.stringify(createAssumedVideoObjectJsonLd({
      name: "watch title",
      author: {
        "@type": "Person",
        name: "watch author",
      },
      thumbnail: [
        {
          "@type": "ImageObject",
          url: "https://example.test/watch.jpg",
        },
      ],
      thumbnailUrl: [
        "https://example.test/watch.jpg",
      ],
    })));
    setGlobalProperty("document", {
      querySelectorAll: () => createNodeList([notScriptElement, invalidScript, validScript]),
    } as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
    });
  });

  test("想定JSON-LD形式からname/author.name/thumbnail[0].urlを抽出できること", () => {
    const script = createScript(JSON.stringify(createAssumedVideoObjectJsonLd()));
    setGlobalProperty("document", {
      querySelectorAll: () => createNodeList([script]),
    } as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: "テスト用ダミー動画",
      author: "Test User",
      thumbnail: "https://example.test/thumbnails/sm9/original.jpg",
    });
  });

  test("配列JSON-LDからVideoObjectを抽出しauthor文字列とthumbnail文字列を扱えること", () => {
    const nonVideoArrayScript = createScript(JSON.stringify([
      { "@type": "Person", name: "someone" },
    ]));
    const videoArrayScript = createScript(JSON.stringify([
      { "@type": "WebPage", name: "page" },
      {
        "@type": "VideoObject",
        name: "array title",
        author: "array author",
        thumbnail: ["https://example.test/array.jpg"],
      },
    ]));
    setGlobalProperty("document", {
      querySelectorAll: () => createNodeList([nonVideoArrayScript, videoArrayScript]),
    } as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: "array title",
      author: "array author",
      thumbnail: "https://example.test/array.jpg",
    });
  });

  test.each([
    {
      testName: "thumbnail候補が不正な場合にthumbnailUrlフォールバックを使えること",
      videoObject: {
        "@type": "VideoObject",
        name: "",
        author: {
          name: " ",
        },
        thumbnail: {},
        thumbnailUrl: "https://example.test/fallback.jpg",
      },
      expected: {
        title: null,
        author: null,
        thumbnail: "https://example.test/fallback.jpg",
      },
    },
    {
      testName: "thumbnail候補が全て不正な場合はnullで返すこと",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: {
          name: "author",
        },
        thumbnail: {
          url: "",
        },
        thumbnailUrl: [123],
      },
      expected: {
        title: "title",
        author: "author",
        thumbnail: null,
      },
    },
    {
      testName: "thumbnail配列が不正でもthumbnailUrl文字列へフォールバックできること",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: 123,
        thumbnail: [" "],
        thumbnailUrl: "https://example.test/fallback-from-thumbnail-url.jpg",
      },
      expected: {
        title: "title",
        author: null,
        thumbnail: "https://example.test/fallback-from-thumbnail-url.jpg",
      },
    },
    {
      testName: "thumbnailオブジェクトのurlを取得できること",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: "author",
        thumbnail: {
          url: "https://example.test/from-thumbnail-object.jpg",
        },
      },
      expected: {
        title: "title",
        author: "author",
        thumbnail: "https://example.test/from-thumbnail-object.jpg",
      },
    },
    {
      testName: "thumbnail未定義かつthumbnailUrl非文字列時はnullで返すこと",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: "author",
        thumbnailUrl: {},
      },
      expected: {
        title: "title",
        author: "author",
        thumbnail: null,
      },
    },
    {
      testName: "thumbnailUrl配列の先頭が空文字列ならnullで返すこと",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: "author",
        thumbnailUrl: [" "],
      },
      expected: {
        title: "title",
        author: "author",
        thumbnail: null,
      },
    },
    {
      testName: "thumbnailUrl配列の先頭が文字列なら取得できること",
      videoObject: {
        "@type": "VideoObject",
        name: "title",
        author: "author",
        thumbnailUrl: ["https://example.test/from-thumbnail-url-array.jpg"],
      },
      expected: {
        title: "title",
        author: "author",
        thumbnail: "https://example.test/from-thumbnail-url-array.jpg",
      },
    },
  ])("$testName", ({ videoObject, expected }) => {
    const script = createScript(JSON.stringify(videoObject));
    setGlobalProperty("document", {
      querySelectorAll: () => createNodeList([script]),
    } as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual(expected);
  });

  test("VideoObject未検出時は空スナップショットを返すこと", () => {
    const nonVideoObjectScript = createScript(JSON.stringify({
      "@type": "WebPage",
      name: "page title",
    }));
    setGlobalProperty("document", {
      querySelectorAll: () => createNodeList([nonVideoObjectScript, createScript(null)]),
    } as unknown as Document);

    const adapter = createVideoInfoAdapter();
    expect(adapter.resolve()).toEqual({
      title: null,
      author: null,
      thumbnail: null,
    });
  });
});
