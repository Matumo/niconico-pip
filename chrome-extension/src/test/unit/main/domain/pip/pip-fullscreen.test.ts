/**
 * pipドメインfullscreen補助テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PipDomainRuntime, ResolvePipRuntime } from "@main/domain/pip/pip-runtime";
import {
  fullscreenToggleObserverKey,
  requestExitBrowserSizeFullscreenForOwnPipEnter,
  requestExitOwnPictureInPicture,
  syncFullscreenToggleObserver,
} from "@main/domain/pip/pip-fullscreen";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

vi.mock("@matumo/ts-simple-logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

const globalPropertyKeys = ["document"] as const;

const createFullscreenToggleButton = (
  initialAriaLabel: string,
): HTMLButtonElement & {
  click: ReturnType<typeof vi.fn>;
} => {
  let ariaLabel = initialAriaLabel;

  return {
    click: vi.fn(),
    getAttribute: (name: string) => name === "aria-label" ? ariaLabel : null,
    setAttribute: (name: string, value: string) => {
      if (name === "aria-label") ariaLabel = value;
    },
  } as unknown as HTMLButtonElement & {
    click: ReturnType<typeof vi.fn>;
  };
};

const createRuntime = (): {
  runtime: PipDomainRuntime;
  observerRegistryObserve: ReturnType<typeof vi.fn>;
  observerRegistryDisconnect: ReturnType<typeof vi.fn>;
  isOwnPictureInPictureElement: ReturnType<typeof vi.fn>;
  resolveRuntime: ResolvePipRuntime;
  getObserverCallback: () => MutationCallback | null;
} => {
  let observerCallback: MutationCallback | null = null;
  const observerRegistryObserve = vi.fn((params: {
    key: string;
    target: Node;
    callback: MutationCallback;
    options: MutationObserverInit;
  }) => {
    observerCallback = params.callback;
    return { disconnect: vi.fn() } as unknown as MutationObserver;
  });
  const observerRegistryDisconnect = vi.fn(() => false);
  const isOwnPictureInPictureElement = vi.fn(() => true);

  const runtime = {
    context: {
      observerRegistry: {
        observe: observerRegistryObserve,
        disconnect: observerRegistryDisconnect,
      },
    },
    pipVideoElementAdapter: {
      isOwnPictureInPictureElement,
    },
    fullscreenToggleButton: null,
    browserSizeFullscreenActive: null,
  } as unknown as PipDomainRuntime;

  return {
    runtime,
    observerRegistryObserve,
    observerRegistryDisconnect,
    isOwnPictureInPictureElement,
    resolveRuntime: () => runtime,
    getObserverCallback: () => observerCallback,
  };
};

describe("pipドメインfullscreen補助", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
    vi.restoreAllMocks();
  });

  test("own PiP有効時だけexitPictureInPictureを要求すること", async () => {
    const { runtime, isOwnPictureInPictureElement } = createRuntime();
    const exitPictureInPicture = vi.fn(async () => undefined);
    setGlobalProperty("document", {
      exitPictureInPicture,
    } satisfies Pick<Document, "exitPictureInPicture">);

    requestExitOwnPictureInPicture(runtime, "unit-test");
    await Promise.resolve();

    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);

    isOwnPictureInPictureElement.mockReturnValue(false);
    requestExitOwnPictureInPicture(runtime, "unit-test:skip");
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
  });

  test("browser-size fullscreen中だけトグルクリックで終了要求すること", () => {
    const { runtime } = createRuntime();
    const fullscreenToggleButton = createFullscreenToggleButton("全画面表示を終了");
    runtime.fullscreenToggleButton = fullscreenToggleButton;

    requestExitBrowserSizeFullscreenForOwnPipEnter(runtime, "unit-test");
    expect(fullscreenToggleButton.click).toHaveBeenCalledTimes(1);

    fullscreenToggleButton.click.mockClear();
    fullscreenToggleButton.setAttribute("aria-label", "全画面表示する");
    requestExitBrowserSizeFullscreenForOwnPipEnter(runtime, "unit-test:skip");
    expect(fullscreenToggleButton.click).not.toHaveBeenCalled();
  });

  test("fullscreenトグル監視の開始、状態更新、解除を同期すること", async () => {
    const {
      runtime,
      observerRegistryObserve,
      observerRegistryDisconnect,
      resolveRuntime,
      getObserverCallback,
    } = createRuntime();
    const exitPictureInPicture = vi.fn(async () => undefined);
    const fullscreenToggleButton = createFullscreenToggleButton("全画面表示する");
    setGlobalProperty("document", {
      exitPictureInPicture,
    } satisfies Pick<Document, "exitPictureInPicture">);

    syncFullscreenToggleObserver({
      runtime,
      nextFullscreenToggleButton: fullscreenToggleButton,
      resolveRuntime,
    });

    expect(runtime.fullscreenToggleButton).toBe(fullscreenToggleButton);
    expect(runtime.browserSizeFullscreenActive).toBe(false);
    expect(observerRegistryObserve).toHaveBeenCalledWith(expect.objectContaining({
      key: fullscreenToggleObserverKey,
      target: fullscreenToggleButton,
    }));

    fullscreenToggleButton.setAttribute("aria-label", "全画面表示を終了");
    getObserverCallback()?.([
      {
        type: "attributes",
        attributeName: "aria-label",
      } as MutationRecord,
    ], {} as MutationObserver);
    await Promise.resolve();

    expect(runtime.browserSizeFullscreenActive).toBe(true);
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);

    syncFullscreenToggleObserver({
      runtime,
      nextFullscreenToggleButton: null,
      resolveRuntime,
    });

    expect(observerRegistryDisconnect).toHaveBeenCalledWith(fullscreenToggleObserverKey);
    expect(runtime.fullscreenToggleButton).toBeNull();
    expect(runtime.browserSizeFullscreenActive).toBeNull();
  });
});
