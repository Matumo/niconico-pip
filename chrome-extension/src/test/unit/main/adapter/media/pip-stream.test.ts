/**
 * PiPストリームテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import {
  createTsSimpleLoggerMockHarness,
  type TsSimpleLoggerMockHarness,
} from "@test/unit/main/shared/logger";

// テスト中に差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = [
  "document",
  "HTMLCanvasElement",
  "requestAnimationFrame",
  "cancelAnimationFrame",
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
}

// テスト用canvas要素
class FakeCanvasElement extends EventTarget {
  width = 0;
  height = 0;
  readonly context = new FakeCanvasRenderingContext2D();
  readonly stream = new FakeMediaStream();

  getContext = vi.fn(() => this.context);
  captureStream = vi.fn(() => this.stream as unknown as MediaStream);
}

// テスト用video要素
class FakeVideoElement extends EventTarget {
  srcObject: MediaProvider | null = null;
  play = vi.fn(async () => undefined);
  pause = vi.fn();
}

// テスト用document
class FakeDocument {
  readonly createdCanvases: FakeCanvasElement[] = [];

  createElement = (tagName: string): Element => {
    if (tagName !== "canvas") return {} as Element;
    const canvas = new FakeCanvasElement();
    this.createdCanvases.push(canvas);
    return canvas as unknown as Element;
  };
}

// テスト用DOM環境を準備する関数
const setupDomEnvironment = () => {
  const documentNode = new FakeDocument();
  let animationFrameId = 1;

  setGlobalProperty("document", documentNode);
  setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
  setGlobalProperty("requestAnimationFrame", vi.fn(() => animationFrameId++));
  setGlobalProperty("cancelAnimationFrame", vi.fn());

  return {
    documentNode,
    requestAnimationFrame: globalThis.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>,
    cancelAnimationFrame: globalThis.cancelAnimationFrame as unknown as ReturnType<typeof vi.fn>,
  };
};

// Promiseチェーン由来の非同期ログ出力を待つ関数
const flushMicrotasks = async (count = 1): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

describe("PiPストリーム", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;
  let createPipStream: typeof import("@main/adapter/media/pip-stream").createPipStream;
  let loggerMockHarness: TsSimpleLoggerMockHarness;

  beforeEach(async () => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createPipStream } = await import("@main/adapter/media/pip-stream"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("生成時にダミーストリームを設定すること", () => {
    const { documentNode } = setupDomEnvironment();
    const pipVideoElement = new FakeVideoElement();

    createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(pipVideoElement.srcObject)
      .toBe(documentNode.createdCanvases[0]?.stream as unknown as MediaStream);
  });

  test("生成時のダミーストリームは黒背景canvasを1fpsで作成すること", () => {
    const { documentNode } = setupDomEnvironment();

    createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const standbyCanvas = documentNode.createdCanvases[0];
    expect(standbyCanvas?.width).toBe(1280);
    expect(standbyCanvas?.height).toBe(720);
    expect(standbyCanvas?.context.fillStyle).toBe("black");
    expect(standbyCanvas?.context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(standbyCanvas?.captureStream).toHaveBeenCalledWith(1);
  });

  test("ダミーストリーム作成に失敗した場合はsrcObjectをnullで開始すること", () => {
    const documentNodeWithoutCanvas = new FakeDocument();
    documentNodeWithoutCanvas.createElement = () => ({}) as Element;
    setGlobalProperty("document", documentNodeWithoutCanvas);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);

    const pipVideoElementWithoutCanvas = new FakeVideoElement();
    createPipStream({
      pipVideoElement: pipVideoElementWithoutCanvas as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(pipVideoElementWithoutCanvas.srcObject).toBeNull();

    const documentNodeWithoutCapture = new FakeDocument();
    documentNodeWithoutCapture.createElement = () => {
      const canvas = new FakeCanvasElement();
      (canvas as unknown as { captureStream?: unknown }).captureStream = undefined;
      return canvas as unknown as Element;
    };
    setGlobalProperty("document", documentNodeWithoutCapture);
    const pipVideoElementWithoutCapture = new FakeVideoElement();
    createPipStream({
      pipVideoElement: pipVideoElementWithoutCapture as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(pipVideoElementWithoutCapture.srcObject).toBeNull();

    const documentNodeWithoutContext = new FakeDocument();
    documentNodeWithoutContext.createElement = () => {
      const canvas = new FakeCanvasElement();
      canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
      return canvas as unknown as Element;
    };
    setGlobalProperty("document", documentNodeWithoutContext);
    const pipVideoElementWithoutContext = new FakeVideoElement();
    createPipStream({
      pipVideoElement: pipVideoElementWithoutContext as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(pipVideoElementWithoutContext.srcObject).toBeNull();
  });

  test("startは描画ターゲット作成失敗時やcaptureStream未対応時にfalseを返すこと", () => {
    setGlobalProperty("document", undefined);
    const controllerWithoutDocument = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(controllerWithoutDocument.start()).toBe(false);

    const documentNodeWithoutCanvas = new FakeDocument();
    documentNodeWithoutCanvas.createElement = () => ({}) as Element;
    setGlobalProperty("document", documentNodeWithoutCanvas);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    const controllerWithoutCanvas = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(controllerWithoutCanvas.start()).toBe(false);

    const documentNodeWithoutContext = new FakeDocument();
    documentNodeWithoutContext.createElement = () => {
      const canvas = new FakeCanvasElement();
      canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
      return canvas as unknown as Element;
    };
    setGlobalProperty("document", documentNodeWithoutContext);
    const controllerWithoutContext = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(controllerWithoutContext.start()).toBe(false);

    const documentNodeWithoutCapture = new FakeDocument();
    documentNodeWithoutCapture.createElement = () => {
      const canvas = new FakeCanvasElement();
      (canvas as unknown as { captureStream?: unknown }).captureStream = undefined;
      return canvas as unknown as Element;
    };
    setGlobalProperty("document", documentNodeWithoutCapture);
    const controllerWithoutCapture = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(controllerWithoutCapture.start()).toBe(false);
  });

  test("startは描画streamへ切り替えて描画ループを開始し、二重開始を抑止すること", async () => {
    const { documentNode, requestAnimationFrame } = setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const pipVideoElement = new FakeVideoElement();
    const renderFrame = vi.fn(() => true);
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    const renderCanvas = documentNode.createdCanvases[1];
    expect(stream.isRunning()).toBe(true);
    expect(pipVideoElement.srcObject).toBe(renderCanvas?.stream as unknown as MediaStream);
    expect(pipVideoElement.play).toHaveBeenCalledTimes(1);
    expect(renderFrame).toHaveBeenCalledWith(
      renderCanvas?.context,
      renderCanvas,
    );
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    expect(stream.start()).toBe(true);
    expect(renderFrame).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    await flushMicrotasks();
    expect(mediaLogger.debug).toHaveBeenCalledWith("pip stream play resolved");
  });

  test("startは指定サイズの描画canvasから本番streamを作成すること", () => {
    const { documentNode } = setupDomEnvironment();
    const stream = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);

    const renderCanvas = documentNode.createdCanvases[1];
    expect(renderCanvas?.width).toBe(1280);
    expect(renderCanvas?.height).toBe(720);
    expect(renderCanvas?.captureStream).toHaveBeenCalledWith();
  });

  test("stop後にstartし直すと既存の描画ターゲットを再利用すること", async () => {
    const { documentNode, requestAnimationFrame } = setupDomEnvironment();
    const pipVideoElement = new FakeVideoElement();
    const renderFrame = vi.fn(() => true);
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    const renderCanvas = documentNode.createdCanvases[1];
    expect(renderCanvas).toBeDefined();

    stream.stop();
    expect(stream.start()).toBe(true);

    expect(documentNode.createdCanvases).toHaveLength(2);
    expect(renderCanvas?.captureStream).toHaveBeenCalledTimes(2);
    expect(renderFrame).toHaveBeenNthCalledWith(1, renderCanvas?.context, renderCanvas);
    expect(renderFrame).toHaveBeenNthCalledWith(2, renderCanvas?.context, renderCanvas);
    expect(pipVideoElement.srcObject).toBe(renderCanvas?.stream as unknown as MediaStream);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    await flushMicrotasks(2);
  });

  test("requestAnimationFrame未対応でも開始処理で例外にしないこと", async () => {
    setupDomEnvironment();
    setGlobalProperty("requestAnimationFrame", undefined);

    const renderFrame = vi.fn(() => true);
    const stream = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(() => stream.start()).not.toThrow();
    await flushMicrotasks();
  });

  test("予約済みrequestAnimationFrameのcallbackはstop後に呼ばれても追加描画しないこと", () => {
    const { requestAnimationFrame } = setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const renderFrame = vi.fn(() => true);
    const stream = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    const scheduledCallback = requestAnimationFrame.mock.calls[0]?.[0] as FrameRequestCallback;

    stream.stop();
    scheduledCallback(16);

    expect(renderFrame).toHaveBeenCalledTimes(1);
    expect(mediaLogger.debug).toHaveBeenCalledWith(
      "pip stream draw loop stopped (precondition not met)",
    );
  });

  test("renderFrame失敗をfail-softで扱いクールダウン付きで次フレームを継続すること", () => {
    const { requestAnimationFrame } = setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const performanceNowMock = vi.spyOn(performance, "now");
    const pipVideoElement = new FakeVideoElement();
    let renderFrameCallCount = 0;
    const renderFrame = vi.fn(() => {
      renderFrameCallCount += 1;
      if (renderFrameCallCount <= 5) {
        throw new Error(`render failed ${renderFrameCallCount}`);
      }
      return true;
    });
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    const invokeScheduledFrameAt = (callIndex: number, now: number): void => {
      performanceNowMock.mockReturnValue(now);
      const scheduledCallback = requestAnimationFrame.mock.calls[callIndex]?.[0] as FrameRequestCallback;
      scheduledCallback(now);
    };

    performanceNowMock.mockReturnValue(1_000);
    expect(stream.start()).toBe(true);
    expect(stream.isRunning()).toBe(true);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    invokeScheduledFrameAt(0, 2_000);
    invokeScheduledFrameAt(1, 3_000);
    invokeScheduledFrameAt(2, 12_000);
    invokeScheduledFrameAt(3, 12_200);
    invokeScheduledFrameAt(4, 12_400);

    expect(renderFrame).toHaveBeenCalledTimes(6);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(6);
    expect(stream.isRunning()).toBe(true);
    expect(pipVideoElement.pause).not.toHaveBeenCalled();
    expect(mediaLogger.warn).toHaveBeenCalledTimes(4);
    expect(mediaLogger.warn).toHaveBeenNthCalledWith(
      1,
      "pip stream renderFrame failed",
      expect.any(Error),
    );
    expect(mediaLogger.warn).toHaveBeenNthCalledWith(
      2,
      "pip stream renderFrame failed logs suppressed during cooldown",
    );
    expect(mediaLogger.warn).toHaveBeenNthCalledWith(
      3,
      "pip stream renderFrame failed",
      expect.any(Error),
    );
    expect(mediaLogger.warn).toHaveBeenNthCalledWith(
      4,
      "pip stream renderFrame failed logs suppressed during cooldown",
    );
  });

  test("renderFrame中にstopされた場合は次フレーム予約せず終了すること", () => {
    setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const pipVideoElement = new FakeVideoElement();
    const renderFrame = vi.fn(() => {
      stream.stop();
      return true;
    });
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    expect(stream.isRunning()).toBe(false);
    expect(pipVideoElement.pause).toHaveBeenCalledTimes(1);
    expect(mediaLogger.debug).toHaveBeenCalledWith(
      "pip stream draw loop stopped (running is false)",
    );
  });

  test("stopは未開始でも安全で、開始後は描画streamを停止して待機streamへ戻すこと", () => {
    const { documentNode, cancelAnimationFrame } = setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const pipVideoElement = new FakeVideoElement();
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(() => stream.stop()).not.toThrow();

    expect(stream.start()).toBe(true);
    stream.stop();

    expect(documentNode.createdCanvases[1]?.stream.track.stop).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.pause).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.srcObject).toBe(documentNode.createdCanvases[0]?.stream as unknown as MediaStream);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(stream.isRunning()).toBe(false);
    expect(mediaLogger.debug).toHaveBeenCalledWith("pip stream draw loop stopped (stop)");
  });

  test("cancelAnimationFrame未対応でもstopとteardownを継続すること", () => {
    setupDomEnvironment();
    const stream = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    setGlobalProperty("cancelAnimationFrame", undefined);
    expect(() => stream.stop()).not.toThrow();

    const anotherStream = createPipStream({
      pipVideoElement: new FakeVideoElement() as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });
    expect(anotherStream.start()).toBe(true);
    expect(() => anotherStream.teardown()).not.toThrow();
  });

  test("playがrejectしても開始処理を継続すること", async () => {
    setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const pipVideoElement = new FakeVideoElement();
    pipVideoElement.play.mockRejectedValueOnce(new Error("play failed"));
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    await flushMicrotasks(2);
    expect(stream.isRunning()).toBe(true);
    expect(mediaLogger.warn).toHaveBeenCalledWith(
      "pip stream play rejected",
      expect.any(Error),
    );
  });

  test("teardownは待機streamも停止してsrcObjectをclearすること", () => {
    const { documentNode, cancelAnimationFrame } = setupDomEnvironment();
    const mediaLogger = loggerMockHarness.resolveMockLogger("media");
    const pipVideoElement = new FakeVideoElement();
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(stream.start()).toBe(true);
    stream.teardown();

    expect(documentNode.createdCanvases[1]?.stream.track.stop).toHaveBeenCalledTimes(1);
    expect(documentNode.createdCanvases[0]?.stream.track.stop).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(pipVideoElement.pause).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.srcObject).toBeNull();
    expect(stream.isRunning()).toBe(false);
    expect(mediaLogger.debug).toHaveBeenCalledWith("pip stream draw loop stopped (teardown)");
  });

  test("teardownは未開始でも待機streamを停止してsrcObjectをclearすること", () => {
    const { documentNode } = setupDomEnvironment();
    const pipVideoElement = new FakeVideoElement();
    const stream = createPipStream({
      pipVideoElement: pipVideoElement as unknown as HTMLVideoElement,
      renderFrame: vi.fn(() => true),
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    expect(() => stream.teardown()).not.toThrow();

    expect(documentNode.createdCanvases[0]?.stream.track.stop).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.pause).toHaveBeenCalledTimes(1);
    expect(pipVideoElement.srcObject).toBeNull();
    expect(stream.isRunning()).toBe(false);
  });
});
