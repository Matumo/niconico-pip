/**
 * 動画情報取得アダプターのランタイムテスト
 */
import { createVideoInfoAdapter } from "@main/adapter/dom/video-info";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// テスト用JSON-LD scriptを設定する関数
const upsertJsonLdScript = (key: string, textContent: string): void => {
  const selector = `script[data-test-role="${key}"]`;
  const existing = globalThis.document.querySelector(selector);
  const script = existing instanceof HTMLScriptElement ?
    existing : globalThis.document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.testRole = key;
  script.textContent = textContent;
  if (!(existing instanceof HTMLScriptElement)) {
    globalThis.document.head.appendChild(script);
  }
};

// テスト用JSON-LD scriptを全削除する関数
const removeAllJsonLdScripts = (): void => {
  const scripts = globalThis.document.querySelectorAll('script[data-test-role^="video-info-runtime-"]');
  for (const script of Array.from(scripts)) {
    script.remove();
  }
};

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const adapter = createVideoInfoAdapter();

  try {
    upsertJsonLdScript("video-info-runtime-invalid", "{");
    upsertJsonLdScript("video-info-runtime-valid", JSON.stringify({
      "@type": "VideoObject",
      name: "runtime object title",
      author: {
        "@type": "Person",
        name: "runtime object author",
      },
      thumbnail: [
        {
          "@type": "ImageObject",
          url: "https://example.test/runtime-object.jpg",
        },
      ],
      thumbnailUrl: [
        "https://example.test/runtime-object.jpg",
      ],
    }));
    const objectSnapshot = adapter.resolve();

    removeAllJsonLdScripts();
    upsertJsonLdScript("video-info-runtime-array", JSON.stringify([
      { "@type": "WebPage", name: "ignored page" },
      {
        "@type": "VideoObject",
        name: "runtime array title",
        author: "runtime array author",
        thumbnailUrl: ["https://example.test/runtime-array.jpg"],
      },
    ]));
    const arraySnapshot = adapter.resolve();

    removeAllJsonLdScripts();
    upsertJsonLdScript("video-info-runtime-non-video", JSON.stringify({
      "@type": "WebPage",
      name: "non video",
    }));
    const nonVideoSnapshot = adapter.resolve();

    removeAllJsonLdScripts();
    const emptySnapshot = adapter.resolve();

    return {
      objectPayloadResolved:
        objectSnapshot.title === "runtime object title" &&
        objectSnapshot.author === "runtime object author" &&
        objectSnapshot.thumbnail === "https://example.test/runtime-object.jpg",
      arrayPayloadResolved:
        arraySnapshot.title === "runtime array title" &&
        arraySnapshot.author === "runtime array author" &&
        arraySnapshot.thumbnail === "https://example.test/runtime-array.jpg",
      nonVideoPayloadResolvedToEmpty:
        nonVideoSnapshot.title === null &&
        nonVideoSnapshot.author === null &&
        nonVideoSnapshot.thumbnail === null,
      cleanupResolvedToEmpty:
        emptySnapshot.title === null &&
        emptySnapshot.author === null &&
        emptySnapshot.thumbnail === null,
    };
  } finally {
    removeAllJsonLdScripts();
  }
};

// エクスポート
export { runTest };
