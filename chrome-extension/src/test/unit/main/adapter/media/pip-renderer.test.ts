/**
 * PiPレンダラーテスト
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const { loggerWarnMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
}));

vi.mock("@matumo/ts-simple-logger", () => ({
  getLogger: vi.fn((name: string) => ({
    name,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
  })),
  setDefaultConfig: vi.fn(),
  setLoggerConfig: vi.fn(),
}));

let createPipRenderer: typeof import("@main/adapter/media/pip-renderer").createPipRenderer;

// テスト用2Dコンテキスト
class FakeCanvasRenderingContext2D {
  fillStyle = "";
  fillRect = vi.fn();
  drawImage = vi.fn();
}

// テスト用canvas要素
class FakeCanvasElement extends EventTarget {
  width = 1280;
  height = 720;
  readonly context = new FakeCanvasRenderingContext2D();
}

// テスト用video要素
class FakeVideoElement extends EventTarget {
  constructor(
    readonly videoWidth: number,
    readonly videoHeight: number,
    readonly readyState: number = 4,
  ) {
    super();
  }
}

describe("PiPレンダラー", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ createPipRenderer } = await import("@main/adapter/media/pip-renderer"));
  });

  test("描画元が空でも背景だけ描画して成功を返すこと", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();
  });

  test("canvasより狭い動画は左右余白で中央配置すること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(640, 480);

    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledTimes(1);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledWith(
      videoElement, 160, 0, 960, 720
    );
  });

  test("コメントcanvasは動画の後に全面へ重ねること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(640, 480);
    const commentsCanvas = new FakeCanvasElement();
    commentsCanvas.width = 320;
    commentsCanvas.height = 180;

    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: commentsCanvas as unknown as HTMLCanvasElement,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenNthCalledWith(
      1, videoElement, 160, 0, 960, 720
    );
    expect(drawCanvas.context.drawImage).toHaveBeenNthCalledWith(
      2, commentsCanvas, 0, 0, 1280, 720
    );
  });

  test("動画メタデータ未確定時は動画描画をskipすること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(0, 0);

    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();
  });

  test("readyStateがHAVE_CURRENT_DATA未満の動画は描画をskipすること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(640, 480, 1);

    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();
  });

  test("動画の幅または高さが0のときは動画描画をskipすること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElementWithZeroHeight = new FakeVideoElement(640, 0);
    const videoElementWithZeroWidth = new FakeVideoElement(0, 480);

    renderer.setSources({
      video: videoElementWithZeroHeight as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();

    renderer.setSources({
      video: videoElementWithZeroWidth as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();
  });

  test("幅または高さが0のコメントcanvasは描画をskipすること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const commentsCanvasWithZeroHeight = new FakeCanvasElement();
    commentsCanvasWithZeroHeight.width = 320;
    commentsCanvasWithZeroHeight.height = 0;
    const commentsCanvasWithZeroWidth = new FakeCanvasElement();
    commentsCanvasWithZeroWidth.width = 0;
    commentsCanvasWithZeroWidth.height = 180;

    renderer.setSources({
      video: null,
      commentsCanvas: commentsCanvasWithZeroHeight as unknown as HTMLCanvasElement,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();

    renderer.setSources({
      video: null,
      commentsCanvas: commentsCanvasWithZeroWidth as unknown as HTMLCanvasElement,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).not.toHaveBeenCalled();
  });

  test("setSourcesで描画元を差し替えると次フレームから新しい描画元だけを使うこと", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const firstVideoElement = new FakeVideoElement(640, 480);
    const secondCommentsCanvas = new FakeCanvasElement();
    secondCommentsCanvas.width = 320;
    secondCommentsCanvas.height = 180;

    renderer.setSources({
      video: firstVideoElement as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });
    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledTimes(1);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledWith(
      firstVideoElement, 160, 0, 960, 720
    );

    drawCanvas.context.drawImage.mockClear();
    renderer.setSources({
      video: null,
      commentsCanvas: secondCommentsCanvas as unknown as HTMLCanvasElement,
    });
    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledTimes(1);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledWith(
      secondCommentsCanvas, 0, 0, 1280, 720
    );
  });

  test("横長動画は上下余白で中央配置すること", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(1920, 800);

    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: null,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledTimes(1);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledWith(
      videoElement, 0, 93.33333333333331, 1280, 533.3333333333334
    );
  });

  test("videoとcommentsのdrawImage失敗をfail-softで扱うこと", () => {
    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(1920, 800);
    const commentsCanvas = new FakeCanvasElement();
    commentsCanvas.width = 320;
    commentsCanvas.height = 180;

    drawCanvas.context.drawImage.mockImplementation(() => {
      throw new Error("drawImage failed");
    });
    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: commentsCanvas as unknown as HTMLCanvasElement,
    });

    expect(renderer.drawFrame(
      drawCanvas.context as unknown as CanvasRenderingContext2D,
      drawCanvas as unknown as HTMLCanvasElement,
    )).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalledTimes(2);
    expect(loggerWarnMock).toHaveBeenCalledTimes(2);
  });

  test("drawImage失敗ログはvideoとcommentsごとにクールダウンし、解除後は再度抑制警告を出せること", () => {
    const performanceNowMock = vi.spyOn(performance, "now");

    const renderer = createPipRenderer();
    const drawCanvas = new FakeCanvasElement();
    const videoElement = new FakeVideoElement(1920, 800);
    const commentsCanvas = new FakeCanvasElement();
    commentsCanvas.width = 320;
    commentsCanvas.height = 180;

    drawCanvas.context.drawImage.mockImplementation(() => {
      throw new Error("drawImage failed");
    });
    renderer.setSources({
      video: videoElement as unknown as HTMLVideoElement,
      commentsCanvas: commentsCanvas as unknown as HTMLCanvasElement,
    });

    const drawFrameAt = (now: number): void => {
      performanceNowMock.mockReturnValue(now);
      expect(renderer.drawFrame(
        drawCanvas.context as unknown as CanvasRenderingContext2D,
        drawCanvas as unknown as HTMLCanvasElement,
      )).toBe(true);
    };

    drawFrameAt(1_000);
    drawFrameAt(2_000);
    drawFrameAt(3_000);
    drawFrameAt(12_000);
    drawFrameAt(12_200);

    expect(loggerWarnMock).toHaveBeenCalledTimes(8);
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      1, "pip video drawImage failed", expect.any(Error)
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      2, "pip comments drawImage failed", expect.any(Error)
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      3, "pip video drawImage failed logs suppressed during cooldown"
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      4, "pip comments drawImage failed logs suppressed during cooldown"
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      5, "pip video drawImage failed", expect.any(Error)
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      6, "pip comments drawImage failed", expect.any(Error)
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      7, "pip video drawImage failed logs suppressed during cooldown"
    );
    expect(loggerWarnMock).toHaveBeenNthCalledWith(
      8, "pip comments drawImage failed logs suppressed during cooldown"
    );
  });
});
