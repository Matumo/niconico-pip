/**
 * PiP動画要素アダプターテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createPipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const helperMocks = vi.hoisted(() => ({
  waitForLoadedMetadata: vi.fn(),
  makePoster16By9: vi.fn(),
  calculatePipVideoElementSize: vi.fn(),
}));

vi.mock("@main/adapter/media/pip-video-element-loaded-metadata", () => ({
  waitForLoadedMetadata: helperMocks.waitForLoadedMetadata,
}));

vi.mock("@main/adapter/media/pip-video-element-poster", () => ({
  makePoster16By9: helperMocks.makePoster16By9,
}));

vi.mock("@main/adapter/media/pip-video-element-size", () => ({
  calculatePipVideoElementSize: helperMocks.calculatePipVideoElementSize,
}));

// テスト中に差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = [
  "document",
  "HTMLVideoElement",
  "HTMLCanvasElement",
  "ResizeObserver",
] as const;

// テスト用track
class FakeMediaStreamTrack {
  stop = vi.fn();
}

// テスト用stream
class FakeMediaStream {
  readonly track = new FakeMediaStreamTrack();

  getTracks = (): FakeMediaStreamTrack[] => [this.track];
}

// テスト用2Dコンテキスト
class FakeCanvasRenderingContext2D {
  fillStyle = "";
  fillRect = vi.fn();
  drawImage = vi.fn();
}

// テスト用canvas要素
class FakeCanvasElement extends EventTarget {
  width = 0;
  height = 0;
  readonly context = new FakeCanvasRenderingContext2D();
  readonly stream = new FakeMediaStream();

  getContext = vi.fn(() => this.context);
  captureStream = vi.fn(() => this.stream as unknown as MediaStream);
  toDataURL = vi.fn(() => "data:image/png;base64,converted");
}

// テスト用video要素
class FakeVideoElement extends EventTarget {
  id = "";
  muted = false;
  autoplay = false;
  loop = false;
  hidden = false;
  readyState = 0;
  parentElement: FakeDivElement | null = null;
  style = {
    width: "",
    height: "",
  } as CSSStyleDeclaration;
  srcObject: MediaProvider | null = null;
  posterValue: string | null = null;
  requestPictureInPictureImpl: (() => Promise<PictureInPictureWindow>) | null = null;

  setAttribute = vi.fn((name: string, value: string) => {
    if (name === "poster") this.posterValue = value;
  });

  getAttribute = vi.fn((name: string) => {
    if (name === "poster") return this.posterValue;
    return null;
  });

  removeAttribute = vi.fn((name: string) => {
    if (name === "poster") this.posterValue = null;
  });

  requestPictureInPicture = vi.fn(async () => {
    if (!this.requestPictureInPictureImpl) {
      throw new Error("requestPictureInPictureImpl is not configured");
    }
    return this.requestPictureInPictureImpl();
  });

  remove = vi.fn(() => {
    this.parentElement?.detachChild(this as unknown as Node);
  });
}

// テスト用div要素
class FakeDivElement extends EventTarget {
  parentElement: FakeDivElement | null = null;
  firstChild: Node | null = null;
  children: Node[] = [];
  nextRect = {
    width: 0,
    height: 0,
  };

  constructor(private readonly documentNode: FakeDocument) {
    super();
  }

  insertBefore = vi.fn((node: Node, _: Node | null) => {
    this.children.unshift(node);
    this.firstChild = this.children[0] ?? null;

    const child = node as unknown as { parentElement?: FakeDivElement | null; id?: string };
    child.parentElement = this;
    if (typeof child.id === "string" && child.id !== "") {
      this.documentNode.registerElement(child.id, node as unknown as Element);
    }
    return node;
  });

  detachChild = (node: Node): void => {
    const index = this.children.indexOf(node);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    this.firstChild = this.children[0] ?? null;

    const child = node as unknown as { parentElement?: FakeDivElement | null; id?: string };
    child.parentElement = null;
    if (typeof child.id === "string" && child.id !== "") {
      this.documentNode.unregisterElement(child.id, node as unknown as Element);
    }
  };

  removeChild = vi.fn((node: Node) => {
    this.detachChild(node);
    return node;
  });

  getBoundingClientRect = vi.fn(() => ({
    width: this.nextRect.width,
    height: this.nextRect.height,
  }));
}

// テスト用ResizeObserver
class FakeResizeObserver {
  public static readonly instances: FakeResizeObserver[] = [];
  observedTarget: Element | null = null;
  disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => {
    this.observedTarget = target;
  });

  fire = (): void => {
    this.callback([], this as unknown as ResizeObserver);
  };
}

// テスト用document
class FakeDocument {
  private readonly elementById = new Map<string, Element>();
  pictureInPictureElement: Element | null = null;
  readonly createdVideos: FakeVideoElement[] = [];
  readonly createdCanvases: FakeCanvasElement[] = [];

  registerElement = (id: string, element: Element): void => {
    this.elementById.set(id, element);
  };

  unregisterElement = (id: string, element: Element): void => {
    const existing = this.elementById.get(id);
    if (existing !== element) return;
    this.elementById.delete(id);
  };

  createElement = (tagName: string): Element => {
    if (tagName === "video") {
      const video = new FakeVideoElement();
      this.createdVideos.push(video);
      return video as unknown as Element;
    }
    if (tagName === "canvas") {
      const canvas = new FakeCanvasElement();
      this.createdCanvases.push(canvas);
      return canvas as unknown as Element;
    }
    return new FakeDivElement(this) as unknown as Element;
  };

  getElementById = (id: string): Element | null =>
    this.elementById.get(id) ?? null;
}

// テスト用DOM環境を準備する関数
const setupDomEnvironment = () => {
  const documentNode = new FakeDocument();
  setGlobalProperty("document", documentNode);
  setGlobalProperty("HTMLVideoElement", FakeVideoElement);
  setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
  setGlobalProperty("ResizeObserver", FakeResizeObserver);
  FakeResizeObserver.instances.length = 0;

  return {
    documentNode,
  };
};

describe("PiP動画要素アダプター", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    helperMocks.waitForLoadedMetadata.mockReset();
    helperMocks.makePoster16By9.mockReset();
    helperMocks.calculatePipVideoElementSize.mockReset();
    helperMocks.waitForLoadedMetadata.mockResolvedValue(true);
    helperMocks.makePoster16By9.mockResolvedValue("data:image/png;base64,converted");
    helperMocks.calculatePipVideoElementSize.mockImplementation((options) => ({
      width: Math.max(1, Math.floor(options.parentWidth)),
      height: Math.max(0, Math.floor(options.parentHeight)),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
    FakeResizeObserver.instances.length = 0;
  });

  test("document未定義時はアダプター生成で例外を返すこと", () => {
    setGlobalProperty("document", undefined);
    expect(() => createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    })).toThrow("document is unavailable");
  });

  test("video要素生成に失敗した場合は例外を返すこと", () => {
    const documentNode = new FakeDocument();
    const originalCreateElement = documentNode.createElement;
    documentNode.createElement = (tagName: string): Element => {
      if (tagName === "video") return {} as Element;
      return originalCreateElement(tagName);
    };
    setGlobalProperty("document", documentNode);
    setGlobalProperty("HTMLVideoElement", FakeVideoElement);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("ResizeObserver", FakeResizeObserver);

    expect(() => createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    })).toThrow("video element creation failed");
  });

  test("target未接続時は挿入せずfalseを返すこと", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const target = new FakeDivElement(documentNode);
    target.parentElement = null;

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(false);
  });

  test("stopは未挿入時でも安全に実行できること", () => {
    setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(() => adapter.stop()).not.toThrow();
  });

  test("挿入時に先頭へ追加しサイズ計算とResizeObserver追従を行うこと", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const rootParent = new FakeDivElement(documentNode);
    const target = new FakeDivElement(documentNode);
    target.parentElement = rootParent;
    target.nextRect = {
      width: 640,
      height: 360,
    };

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);

    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;
    expect(target.firstChild).toBe(pipVideoElement as unknown as Node);
    expect(pipVideoElement.style.width).toBe("640px");
    expect(pipVideoElement.style.height).toBe("360px");

    const resizeObserver = FakeResizeObserver.instances[0];
    expect(resizeObserver).toBeDefined();
    expect(resizeObserver.observe).toHaveBeenCalledWith(target as unknown as Element);

    target.nextRect = {
      width: 320,
      height: 180,
    };
    resizeObserver.fire();
    expect(pipVideoElement.style.width).toBe("320px");
    expect(pipVideoElement.style.height).toBe("180px");
    expect(helperMocks.calculatePipVideoElementSize).toHaveBeenNthCalledWith(1, {
      parentWidth: 640,
      parentHeight: 360,
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(helperMocks.calculatePipVideoElementSize).toHaveBeenNthCalledWith(2, {
      parentWidth: 320,
      parentHeight: 180,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    adapter.stop();
    expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.parentElement).toBeNull();
    expect(target.firstChild).toBeNull();
    expect(documentNode.getElementById("pip-video")).toBeNull();

    const dummyStream = documentNode.createdCanvases[0]?.stream;
    expect(dummyStream?.track.stop).toHaveBeenCalledTimes(1);
  });

  test("stop後は同じtargetへ再挿入できること", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const rootParent = new FakeDivElement(documentNode);
    const target = new FakeDivElement(documentNode);
    target.parentElement = rootParent;
    target.nextRect = {
      width: 640,
      height: 360,
    };

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;
    expect(target.firstChild).toBe(pipVideoElement as unknown as Node);

    adapter.stop();
    expect(target.firstChild).toBeNull();
    expect(documentNode.getElementById("pip-video")).toBeNull();

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    expect(target.firstChild).toBe(pipVideoElement as unknown as Node);
    expect(documentNode.getElementById("pip-video")).toBe(pipVideoElement as unknown as Element);
  });

  test("observe再設定時は既存observerをdisconnectし、ResizeObserver未対応時は監視をskipすること", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const rootParent = new FakeDivElement(documentNode);
    const target = new FakeDivElement(documentNode);
    target.parentElement = rootParent;
    target.nextRect = {
      width: 640,
      height: 360,
    };
    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);

    const previousObserver = FakeResizeObserver.instances[0];
    expect(previousObserver).toBeDefined();

    documentNode.getElementById = vi.fn(() => null);
    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    expect(previousObserver.disconnect).toHaveBeenCalledTimes(1);

    setGlobalProperty("ResizeObserver", undefined);
    const adapterWithoutObserver = createPipVideoElementAdapter({
      elementId: "pip-video-no-observer",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    const targetWithoutObserver = new FakeDivElement(documentNode);
    targetWithoutObserver.parentElement = rootParent;
    targetWithoutObserver.nextRect = {
      width: 640,
      height: 360,
    };
    expect(adapterWithoutObserver.ensureInserted(targetWithoutObserver as unknown as HTMLDivElement)).toBe(true);
    expect(FakeResizeObserver.instances).toHaveLength(2);
  });

  test("insertBeforeが親子リンクを作らない環境でも例外なく処理継続すること", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    const rootParent = new FakeDivElement(documentNode);

    const detachedInsertTarget = {
      parentElement: rootParent,
      firstChild: null as Node | null,
      insertBefore: vi.fn((node: Node) => node),
      getBoundingClientRect: vi.fn(() => ({
        width: 640,
        height: 360,
      })),
    } as unknown as HTMLDivElement;

    expect(adapter.ensureInserted(detachedInsertTarget)).toBe(true);
    expect(adapter.updateSize()).toBe(false);
  });

  test("同じidの既存要素が別インスタンスなら除去して再挿入すること", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const rootParent = new FakeDivElement(documentNode);
    const target = new FakeDivElement(documentNode);
    target.parentElement = rootParent;
    target.nextRect = {
      width: 640,
      height: 360,
    };

    const staleElement = new FakeVideoElement();
    documentNode.registerElement("pip-video", staleElement as unknown as Element);
    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;
    expect(staleElement.remove).toHaveBeenCalledTimes(1);
    expect(target.insertBefore).toHaveBeenCalledWith(pipVideoElement as unknown as Node, null);
    expect(target.firstChild).toBe(pipVideoElement as unknown as Node);
    expect(documentNode.getElementById("pip-video")).toBe(pipVideoElement as unknown as Element);
  });

  test("同じidの既存要素が自分自身なら再挿入しないこと", () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const rootParent = new FakeDivElement(documentNode);
    const target = new FakeDivElement(documentNode);
    target.parentElement = rootParent;
    target.nextRect = {
      width: 640,
      height: 360,
    };

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;
    expect(target.insertBefore).toHaveBeenCalledTimes(1);

    expect(adapter.ensureInserted(target as unknown as HTMLDivElement)).toBe(true);
    expect(target.insertBefore).toHaveBeenCalledTimes(1);
    expect(target.firstChild).toBe(pipVideoElement as unknown as Node);
  });

  test("updatePosterは成功時に設定し、未指定時はposterを削除してfalseを返すこと", async () => {
    setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;

    expect(await adapter.updatePoster("https://example.test/success.jpg")).toBe(true);
    expect(pipVideoElement.getAttribute("poster")).toBe("data:image/png;base64,converted");
    expect(helperMocks.makePoster16By9).toHaveBeenCalledWith(
      "https://example.test/success.jpg",
      expect.objectContaining({
        createElement: expect.any(Function),
      }),
    );
    expect(await adapter.updatePoster(null)).toBe(false);
    expect(pipVideoElement.getAttribute("poster")).toBeNull();
    expect(pipVideoElement.removeAttribute).toHaveBeenCalledWith("poster");
    expect(helperMocks.makePoster16By9).toHaveBeenCalledTimes(1);
  });

  test("updatePosterは変換失敗時に元URLへフォールバックすること", async () => {
    setupDomEnvironment();
    helperMocks.makePoster16By9.mockRejectedValueOnce(new Error("poster convert failed"));
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;

    expect(await adapter.updatePoster("https://example.test/fallback.jpg")).toBe(true);
    expect(pipVideoElement.getAttribute("poster")).toBe("https://example.test/fallback.jpg");
  });

  test("初期ダミーストリーム作成でcanvas/captureStream/context不備時はsrcObjectがnullになること", () => {
    const documentNodeNoCanvas = new FakeDocument();
    documentNodeNoCanvas.createElement = (tagName: string): Element => {
      if (tagName === "video") return new FakeVideoElement() as unknown as Element;
      if (tagName === "canvas") return {} as Element;
      return new FakeDivElement(documentNodeNoCanvas) as unknown as Element;
    };
    setGlobalProperty("document", documentNodeNoCanvas);
    setGlobalProperty("HTMLVideoElement", FakeVideoElement);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("ResizeObserver", FakeResizeObserver);
    const adapterNoCanvas = createPipVideoElementAdapter({
      elementId: "pip-video-no-canvas",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect((adapterNoCanvas.getElement() as unknown as FakeVideoElement).srcObject).toBeNull();

    const documentNodeNoCapture = new FakeDocument();
    documentNodeNoCapture.createElement = (tagName: string): Element => {
      if (tagName === "video") return new FakeVideoElement() as unknown as Element;
      if (tagName === "canvas") {
        const canvas = new FakeCanvasElement();
        (canvas as unknown as { captureStream?: unknown }).captureStream = undefined;
        return canvas as unknown as Element;
      }
      return new FakeDivElement(documentNodeNoCapture) as unknown as Element;
    };
    setGlobalProperty("document", documentNodeNoCapture);
    const adapterNoCapture = createPipVideoElementAdapter({
      elementId: "pip-video-no-capture",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect((adapterNoCapture.getElement() as unknown as FakeVideoElement).srcObject).toBeNull();

    const documentNodeNoContext = new FakeDocument();
    documentNodeNoContext.createElement = (tagName: string): Element => {
      if (tagName === "video") return new FakeVideoElement() as unknown as Element;
      if (tagName === "canvas") {
        const canvas = new FakeCanvasElement();
        canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
        return canvas as unknown as Element;
      }
      return new FakeDivElement(documentNodeNoContext) as unknown as Element;
    };
    setGlobalProperty("document", documentNodeNoContext);
    const adapterNoContext = createPipVideoElementAdapter({
      elementId: "pip-video-no-context",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect((adapterNoContext.getElement() as unknown as FakeVideoElement).srcObject).toBeNull();
  });

  test("requestPictureInPictureはloadedmetadata待機ヘルパーとnative API結果に応じて処理すること", async () => {
    const { documentNode } = setupDomEnvironment();
    const adapter = createPipVideoElementAdapter({
      elementId: "pip-video",
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    const pipVideoElement = adapter.getElement() as unknown as FakeVideoElement;

    pipVideoElement.requestPictureInPictureImpl = vi.fn(async () => ({} as PictureInPictureWindow));
    helperMocks.waitForLoadedMetadata.mockResolvedValueOnce(true);
    expect(await adapter.requestPictureInPicture()).toBe(true);
    expect(pipVideoElement.requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(helperMocks.waitForLoadedMetadata).toHaveBeenCalledWith(pipVideoElement);

    helperMocks.waitForLoadedMetadata.mockResolvedValueOnce(false);
    expect(await adapter.requestPictureInPicture()).toBe(false);
    expect(pipVideoElement.requestPictureInPicture).toHaveBeenCalledTimes(1);

    pipVideoElement.requestPictureInPictureImpl = null;
    helperMocks.waitForLoadedMetadata.mockResolvedValueOnce(true);
    expect(await adapter.requestPictureInPicture()).toBe(false);
    expect(helperMocks.waitForLoadedMetadata).toHaveBeenCalledTimes(3);

    (pipVideoElement as unknown as { requestPictureInPicture?: unknown }).requestPictureInPicture = undefined;
    expect(await adapter.requestPictureInPicture()).toBe(false);
    expect(helperMocks.waitForLoadedMetadata).toHaveBeenCalledTimes(3);

    const foreignVideoElement = new FakeVideoElement();
    expect(adapter.isOwnPictureInPictureElement(pipVideoElement as unknown as EventTarget)).toBe(true);
    expect(adapter.isOwnPictureInPictureElement(foreignVideoElement as unknown as EventTarget)).toBe(false);

    documentNode.pictureInPictureElement = pipVideoElement as unknown as Element;
    expect(adapter.isOwnPictureInPictureElement()).toBe(true);
    documentNode.pictureInPictureElement = null;
    expect(adapter.isOwnPictureInPictureElement()).toBe(false);
  });
});
