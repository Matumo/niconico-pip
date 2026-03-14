/**
 * debug dump用DOM要約テスト
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createElementDebugSnapshot,
  createElementListDebugSnapshot,
  createEventTargetDebugSnapshot,
  createNodeDebugSnapshot,
} from "@main/debug/debug-dump-dom-snapshot";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

const globalPropertyKeys = [
  "Element",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLDivElement",
  "HTMLVideoElement",
  "HTMLCanvasElement",
  "Document",
  "window",
  "self",
  "top",
  "parent",
  "frames",
  "globalThis",
] as const;

class FakeElement extends EventTarget {
  tagName: string;
  isConnected = true;

  constructor(tagName: string) {
    super();
    this.tagName = tagName;
  }
}

class FakeHTMLElement extends FakeElement {
  id = "";
  className = "";
  hidden = false;
  textContent: string | null = null;
  private readonly attributes = new Map<string, string>();

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeButtonElement extends FakeHTMLElement {
  disabled = false;

  constructor() {
    super("BUTTON");
  }
}

class FakeDivElement extends FakeHTMLElement {
  childElementCount = 0;

  constructor() {
    super("DIV");
  }
}

class FakeVideoElement extends FakeHTMLElement {
  currentSrc = "";
  readyState = 0;
  paused = true;
  ended = false;
  videoWidth = 0;
  videoHeight = 0;
  currentTime = 0;

  constructor() {
    super("VIDEO");
  }
}

class FakeCanvasElement extends FakeHTMLElement {
  width = 0;
  height = 0;

  constructor() {
    super("CANVAS");
  }
}

class FakeDocument extends EventTarget {}

describe("debug dump用DOM要約", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    setGlobalProperty("Element", FakeElement);
    setGlobalProperty("HTMLElement", FakeHTMLElement);
    setGlobalProperty("HTMLButtonElement", FakeButtonElement);
    setGlobalProperty("HTMLDivElement", FakeDivElement);
    setGlobalProperty("HTMLVideoElement", FakeVideoElement);
    setGlobalProperty("HTMLCanvasElement", FakeCanvasElement);
    setGlobalProperty("Document", FakeDocument);
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("Element系の要約を型ごとに生成できること", () => {
    expect(createElementDebugSnapshot(null)).toBeNull();

    const bareElement = new FakeElement("SPAN");
    expect(createElementDebugSnapshot(bareElement as unknown as Element)).toEqual({
      tagName: "span",
      isConnected: true,
    });

    const button = new FakeButtonElement();
    button.id = " ";
    button.className = " button-primary ";
    button.hidden = true;
    button.textContent = "x".repeat(121);
    button.setAttribute("aria-label", " play ");
    button.disabled = true;
    expect(createElementDebugSnapshot(button as unknown as Element)).toEqual({
      tagName: "button",
      isConnected: true,
      id: null,
      className: "button-primary",
      hidden: true,
      text: `${"x".repeat(120)}...`,
      ariaLabel: "play",
      disabled: true,
    });

    const div = new FakeDivElement();
    div.id = "player";
    div.className = " player-shell ";
    div.textContent = " container ";
    div.childElementCount = 3;
    expect(createElementDebugSnapshot(div as unknown as Element)).toEqual({
      tagName: "div",
      isConnected: true,
      id: "player",
      className: "player-shell",
      hidden: false,
      text: "container",
      childElementCount: 3,
    });

    const video = new FakeVideoElement();
    video.currentSrc = "https://example.test/video.mp4";
    video.readyState = 4;
    video.paused = false;
    video.ended = false;
    video.videoWidth = 1280;
    video.videoHeight = 720;
    video.currentTime = 12.5;
    expect(createElementDebugSnapshot(video as unknown as Element)).toEqual({
      tagName: "video",
      isConnected: true,
      id: null,
      className: null,
      hidden: false,
      text: null,
      currentSrc: "https://example.test/video.mp4",
      readyState: 4,
      paused: false,
      ended: false,
      videoWidth: 1280,
      videoHeight: 720,
      currentTime: 12.5,
    });

    const infiniteTimeVideo = new FakeVideoElement();
    infiniteTimeVideo.currentTime = Number.POSITIVE_INFINITY;
    expect(createElementDebugSnapshot(infiniteTimeVideo as unknown as Element)).toMatchObject({
      currentTime: null,
    });

    const canvas = new FakeCanvasElement();
    canvas.width = 640;
    canvas.height = 360;
    expect(createElementDebugSnapshot(canvas as unknown as Element)).toEqual({
      tagName: "canvas",
      isConnected: true,
      id: null,
      className: null,
      hidden: false,
      text: null,
      width: 640,
      height: 360,
    });
  });

  test("Nodeの種類ごとに要約を生成できること", () => {
    const div = new FakeDivElement();
    const documentNode = new FakeDocument();
    const nodeLike = {
      nodeType: 3,
      nodeName: " #text ",
    };

    expect(createNodeDebugSnapshot(null)).toBeNull();
    expect(createNodeDebugSnapshot(div as unknown as Node)).toEqual({
      kind: "element",
      element: {
        tagName: "div",
        isConnected: true,
        id: null,
        className: null,
        hidden: false,
        text: null,
        childElementCount: 0,
      },
    });
    expect(createNodeDebugSnapshot(documentNode as unknown as Node)).toEqual({
      kind: "document",
    });
    expect(createNodeDebugSnapshot(nodeLike as unknown as Node)).toEqual({
      kind: "node",
      nodeType: 3,
      nodeName: "#text",
    });
  });

  test("EventTargetの種類ごとに要約を生成できること", () => {
    const documentNode = new FakeDocument();
    const button = new FakeButtonElement();
    class CustomTarget extends EventTarget {}
    const unknownTarget = { constructor: undefined } as unknown as EventTarget;

    expect(createEventTargetDebugSnapshot(null)).toBeNull();
    expect(createEventTargetDebugSnapshot(globalThis)).toEqual({
      kind: "window",
    });
    expect(createEventTargetDebugSnapshot(button as unknown as EventTarget)).toEqual({
      kind: "element",
      element: {
        tagName: "button",
        isConnected: true,
        id: null,
        className: null,
        hidden: false,
        text: null,
        ariaLabel: null,
        disabled: false,
      },
    });
    expect(createEventTargetDebugSnapshot(documentNode as unknown as EventTarget)).toEqual({
      kind: "document",
    });
    expect(createEventTargetDebugSnapshot(new CustomTarget())).toEqual({
      kind: "CustomTarget",
    });
    expect(createEventTargetDebugSnapshot(unknownTarget)).toEqual({
      kind: "unknown",
    });
  });

  test("要素一覧を配列へ要約できること", () => {
    const div = new FakeDivElement();
    div.id = "player";
    const canvas = new FakeCanvasElement();
    canvas.width = 640;
    canvas.height = 360;

    expect(createElementListDebugSnapshot([
      div as unknown as Element,
      canvas as unknown as Element,
    ])).toEqual([
      {
        tagName: "div",
        isConnected: true,
        id: "player",
        className: null,
        hidden: false,
        text: null,
        childElementCount: 0,
      },
      {
        tagName: "canvas",
        isConnected: true,
        id: null,
        className: null,
        hidden: false,
        text: null,
        width: 640,
        height: 360,
      },
    ]);
  });
});
