/**
 * PiP動画要素 poster変換テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makePoster16By9 } from "@main/adapter/media/pip-video-element-poster";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const globalPropertyKeys = ["Image", "HTMLCanvasElement"] as const;

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
    | "errorThenSuccess" = "success";
  static readonly instances: FakeImage[] = [];

  static setMode(
    mode: "success" | "error" | "successThenError" | "errorThenSuccess",
  ): void {
    FakeImage.currentMode = mode;
  }

  constructor() {
    FakeImage.instances.push(this);
  }

  crossOrigin: string | null = null;
  width = 1600;
  height = 1200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
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
    this.onerror?.();
    this.onload?.();
  }
}

describe("PiP動画要素 poster変換", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    FakeImage.instances.length = 0;
    FakeImage.setMode("success");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
    FakeImage.instances.length = 0;
    FakeImage.setMode("success");
  });

  test("Image未対応時はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", undefined);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/no-image.jpg", documentNode)).rejects.toThrow(
      "poster conversion is unavailable",
    );
  });

  test("変換成功時は16:9へ中央トリミングしたdata URLを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const createdCanvases: FakeCanvasElement[] = [];
    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        createdCanvases.push(canvas);
        return canvas as unknown as HTMLElement;
      }),
    };

    await expect(makePoster16By9("https://example.test/success.jpg", documentNode)).resolves.toBe(
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

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => ({}) as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/no-canvas.jpg", documentNode)).rejects.toThrow(
      "poster conversion canvas is unavailable",
    );
  });

  test("変換用canvasのcontextが取得できない場合はTypeErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
        return canvas as unknown as HTMLElement;
      }),
    };

    await expect(makePoster16By9("https://example.test/no-context.jpg", documentNode)).rejects.toThrow(
      "poster conversion context is unavailable",
    );
  });

  test("画像読み込み失敗時はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/image-error.jpg", documentNode)).rejects.toThrow(
      "poster image load failed",
    );
  });

  test("無効URLの画像取得に失敗した場合はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/not-found.png", documentNode)).rejects.toThrow(
      "poster image load failed",
    );
  });

  test("非画像データの読み込みに失敗した場合はErrorを返すこと", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("error");

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(
      makePoster16By9("data:text/plain;base64,SGVsbG8sIHBvc3RlciB0ZXN0", documentNode),
    ).rejects.toThrow("poster image load failed");
  });

  test("createElementが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => {
        throw new Error("createElement failed");
      }),
    };

    await expect(makePoster16By9("https://example.test/create-throw.jpg", documentNode)).rejects.toThrow(
      "createElement failed",
    );
  });

  test("drawImageが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.context.drawImage = vi.fn(() => {
          throw new Error("drawImage failed");
        });
        return canvas as unknown as HTMLElement;
      }),
    };

    await expect(makePoster16By9("https://example.test/draw-throw.jpg", documentNode)).rejects.toThrow(
      "drawImage failed",
    );
  });

  test("toDataURLが例外を投げた場合はrejectすること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => {
        const canvas = new FakeCanvasElement();
        canvas.toDataURL = vi.fn(() => {
          throw new Error("toDataURL failed");
        });
        return canvas as unknown as HTMLElement;
      }),
    };

    await expect(makePoster16By9("https://example.test/dataurl-throw.jpg", documentNode)).rejects.toThrow(
      "toDataURL failed",
    );
  });

  test("onloadの後にonerrorが来ても最初の成功結果を維持すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("successThenError");

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/success-then-error.jpg", documentNode)).resolves.toBe(
      "data:image/png;base64,converted",
    );
  });

  test("onerrorの後にonloadが来ても最初の失敗結果を維持すること", async () => {
    setGlobalProperty("Image", FakeImage);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    FakeImage.setMode("errorThenSuccess");

    const documentNode: Pick<Document, "createElement"> = {
      createElement: vi.fn(() => new FakeCanvasElement() as unknown as HTMLElement),
    };

    await expect(makePoster16By9("https://example.test/error-then-success.jpg", documentNode)).rejects.toThrow(
      "poster image load failed",
    );
  });
});
