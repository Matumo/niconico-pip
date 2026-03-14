/**
 * PiP動画要素 poster変換テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createPosterDataUrlCache } from "@main/adapter/media/pip-video-element/pip-video-element-poster-cache";
import { getPosterDataUrl } from "@main/adapter/media/pip-video-element/pip-video-element-poster";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const globalPropertyKeys = ["document", "Image", "HTMLCanvasElement"] as const;

interface PosterDocumentLike {
  createElement(tagName: string): Element;
}

class FakeCanvasRenderingContext2D {
  drawImage = vi.fn();
}

class FakeCanvasElement {
  width = 0;
  height = 0;
  readonly context = new FakeCanvasRenderingContext2D();

  getContext = vi.fn(() => this.context);
  toDataURL = vi.fn(() => "data:image/png;base64,converted");
}

class FakeImage {
  private static currentMode:
    | "success"
    | "error"
    | "successThenError"
    | "errorThenSuccess"
    | "manual" = "success";
  static readonly instances: FakeImage[] = [];
  static readonly srcValues: string[] = [];
  static readonly pendingImages: FakeImage[] = [];

  static setMode(
    mode: "success" | "error" | "successThenError" | "errorThenSuccess" | "manual",
  ): void {
    FakeImage.currentMode = mode;
  }

  static flushPendingSuccess(): void {
    const pendingImages = [...FakeImage.pendingImages];
    FakeImage.pendingImages.length = 0;
    for (const image of pendingImages) {
      image.onload?.();
    }
  }

  constructor() {
    FakeImage.instances.push(this);
  }

  crossOrigin: string | null = null;
  width = 1600;
  height = 1200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    FakeImage.srcValues.push(value);
    if (FakeImage.currentMode === "success") {
      this.onload?.();
      return;
    }
    if (FakeImage.currentMode === "error") {
      this.onerror?.();
      return;
    }
    if (FakeImage.currentMode === "successThenError") {
      this.onload?.();
      this.onerror?.();
      return;
    }
    if (FakeImage.currentMode === "manual") {
      FakeImage.pendingImages.push(this);
      return;
    }
    this.onerror?.();
    this.onload?.();
  }
}

const createPosterDocumentNode = () => {
  const createdCanvases: FakeCanvasElement[] = [];
  const documentNode: PosterDocumentLike = {
    createElement: vi.fn(() => {
      const canvas = new FakeCanvasElement();
      createdCanvases.push(canvas);
      return canvas as unknown as Element;
    }),
  };
  setGlobalProperty("document", documentNode);
  return {
    createdCanvases,
    documentNode,
  };
};

const getPosterDataUrlWithFreshCache = (thumbnailUrl: string): Promise<string> =>
  getPosterDataUrl({
    thumbnailUrl,
    posterDataUrlCache: createPosterDataUrlCache({
      maxEntries: 3,
    }),
  });

describe("PiP動画要素 poster変換", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    FakeImage.instances.length = 0;
    FakeImage.srcValues.length = 0;
    FakeImage.pendingImages.length = 0;
    FakeImage.setMode("success");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
    FakeImage.instances.length = 0;
    FakeImage.srcValues.length = 0;
    FakeImage.pendingImages.length = 0;
    FakeImage.setMode("success");
  });

  test("Image未対応時はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", undefined);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/no-image.jpg")).rejects.toThrow(
      "poster conversion is unavailable",
    );
  });

  test("document未対応時はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("document", undefined);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    await expect(getPosterDataUrlWithFreshCache("https://example.test/no-document.jpg")).rejects.toThrow(
      "poster conversion document is unavailable",
    );
  });

  test("documentのcreateElementが関数でない場合はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("document", {
      createElement: 1,
    });
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    await expect(getPosterDataUrlWithFreshCache("https://example.test/invalid-document.jpg")).rejects.toThrow(
      "poster conversion document is unavailable",
    );
  });

  test("変換成功時は16:9へ中央トリミングしたdata URLを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    const { createdCanvases } = createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/success.jpg")).resolves.toBe(
      "data:image/png;base64,converted",
    );
    const image = FakeImage.instances[0];
    const canvas = createdCanvases[0];
    expect(image?.crossOrigin).toBe("anonymous");
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(canvas.context.drawImage).toHaveBeenCalledWith(image, 0, 150, 1600, 900, 0, 0, 1600, 900);
  });

  test("変換用canvasが利用できない場合はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("document", {
      createElement: vi.fn(() => ({}) as unknown as HTMLElement),
    });

    await expect(getPosterDataUrlWithFreshCache("https://example.test/no-canvas.jpg")).rejects.toThrow(
      "poster conversion canvas is unavailable",
    );
  });

  test("変換用canvasのcontextが取得できない場合はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("document", {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
        return canvas as unknown as HTMLElement;
      }),
    });

    await expect(getPosterDataUrlWithFreshCache("https://example.test/no-context.jpg")).rejects.toThrow(
      "poster conversion context is unavailable",
    );
  });

  test("画像読み込み失敗時はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");
    createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/image-error.jpg")).rejects.toThrow(
      "poster image load failed",
    );
  });

  test("無効URLの画像取得に失敗した場合はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");
    createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/not-found.png")).rejects.toThrow(
      "poster image load failed",
    );
  });

  test("非画像データの読み込みに失敗した場合はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");
    createPosterDocumentNode();

    await expect(
      getPosterDataUrlWithFreshCache("data:text/plain;base64,SGVsbG8sIHBvc3RlciB0ZXN0"),
    ).rejects.toThrow("poster image load failed");
  });

  test("createElementが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("document", {
      createElement: vi.fn(() => {
        throw new Error("createElement failed");
      }),
    });

    await expect(getPosterDataUrlWithFreshCache("https://example.test/create-throw.jpg")).rejects.toThrow(
      "createElement failed",
    );
  });

  test("drawImageが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("document", {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.context.drawImage = vi.fn(() => {
          throw new Error("drawImage failed");
        });
        return canvas as unknown as HTMLElement;
      }),
    });

    await expect(getPosterDataUrlWithFreshCache("https://example.test/draw-throw.jpg")).rejects.toThrow(
      "drawImage failed",
    );
  });

  test("toDataURLが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("document", {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.toDataURL = vi.fn(() => {
          throw new Error("toDataURL failed");
        });
        return canvas as unknown as HTMLElement;
      }),
    });

    await expect(getPosterDataUrlWithFreshCache("https://example.test/dataurl-throw.jpg")).rejects.toThrow(
      "toDataURL failed",
    );
  });

  test("onloadの後にonerrorが来ても最初の成功結果を維持すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("successThenError");
    createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/success-then-error.jpg")).resolves.toBe(
      "data:image/png;base64,converted",
    );
  });

  test("onerrorの後にonloadが来ても最初の失敗結果を維持すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("errorThenSuccess");
    createPosterDocumentNode();

    await expect(getPosterDataUrlWithFreshCache("https://example.test/error-then-success.jpg")).rejects.toThrow(
      "poster image load failed",
    );
  });

  test("getPosterDataUrlはkeyパラメーターだけ異なるURLでも同じcache entryを使うこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    createPosterDocumentNode();
    const posterDataUrlCache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    await expect(getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?key=aaa&foo=1",
      posterDataUrlCache,
    })).resolves.toBe("data:image/png;base64,converted");
    await expect(getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?foo=1&key=bbb",
      posterDataUrlCache,
    })).resolves.toBe("data:image/png;base64,converted");

    expect(FakeImage.instances).toHaveLength(1);
    expect(FakeImage.srcValues).toEqual([
      "https://example.test/thumb.jpg?key=aaa&foo=1",
    ]);
  });

  test("getPosterDataUrlは同時実行時に同じcache keyの進行中Promiseを共有して重複変換しないこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("manual");
    createPosterDocumentNode();
    const posterDataUrlCache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    const firstResolve = getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?key=aaa",
      posterDataUrlCache,
    });
    const secondResolve = getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?key=bbb",
      posterDataUrlCache,
    });

    expect(secondResolve).toBe(firstResolve);
    expect(FakeImage.instances).toHaveLength(1);
    FakeImage.flushPendingSuccess();

    await expect(firstResolve).resolves.toBe("data:image/png;base64,converted");
    await expect(secondResolve).resolves.toBe("data:image/png;base64,converted");
  });

  test("getPosterDataUrlは変換失敗時にcacheから外して次回再試行すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");
    createPosterDocumentNode();
    const posterDataUrlCache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    await expect(getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?key=aaa",
      posterDataUrlCache,
    })).rejects.toThrow("poster image load failed");
    await expect(getPosterDataUrl({
      thumbnailUrl: "https://example.test/thumb.jpg?key=bbb",
      posterDataUrlCache,
    })).rejects.toThrow("poster image load failed");

    expect(FakeImage.instances).toHaveLength(2);
  });

  test("getPosterDataUrlはFIFOで最大件数を超えたら最古entryから再生成すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    createPosterDocumentNode();
    const posterDataUrlCache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    await getPosterDataUrl({ thumbnailUrl: "https://example.test/1.jpg?key=a", posterDataUrlCache });
    await getPosterDataUrl({ thumbnailUrl: "https://example.test/2.jpg?key=a", posterDataUrlCache });
    await getPosterDataUrl({ thumbnailUrl: "https://example.test/3.jpg?key=a", posterDataUrlCache });
    await getPosterDataUrl({ thumbnailUrl: "https://example.test/2.jpg?key=b", posterDataUrlCache });
    await getPosterDataUrl({ thumbnailUrl: "https://example.test/4.jpg?key=a", posterDataUrlCache });
    await getPosterDataUrl({ thumbnailUrl: "https://example.test/1.jpg?key=b", posterDataUrlCache });

    expect(FakeImage.srcValues).toEqual([
      "https://example.test/1.jpg?key=a",
      "https://example.test/2.jpg?key=a",
      "https://example.test/3.jpg?key=a",
      "https://example.test/4.jpg?key=a",
      "https://example.test/1.jpg?key=b",
    ]);
  });
});
