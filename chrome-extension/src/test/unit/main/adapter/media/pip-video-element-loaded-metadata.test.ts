/**
 * PiP動画要素 loadedmetadata待機テスト
 */
import { describe, expect, test, vi } from "vitest";
import { waitForLoadedMetadata } from "@main/adapter/media/pip-video-element-loaded-metadata";

describe("PiP動画要素 loadedmetadata待機", () => {
  test("開始時点でreadyStateが準備済みなら即時trueで終了すること", async () => {
    const videoElement = {
      readyState: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;

    await expect(waitForLoadedMetadata(videoElement)).resolves.toBe(true);
    expect(videoElement.addEventListener).not.toHaveBeenCalled();
    expect(videoElement.removeEventListener).not.toHaveBeenCalled();
  });

  test("初回チェック後に準備済みへ遷移した場合は後段チェックでtrueにすること", async () => {
    let readyStateValue = 0;
    const getReadyState = vi.fn(() => readyStateValue);
    const addEventListener = vi.fn(() => {
      // リスナー登録中にreadyStateが準備済みへ遷移したケースを再現
      readyStateValue = 1;
    });
    const removeEventListener = vi.fn();
    const videoElement = {
      get readyState() {
        return getReadyState();
      },
      addEventListener,
      removeEventListener,
    } as unknown as HTMLVideoElement;

    await expect(waitForLoadedMetadata(videoElement)).resolves.toBe(true);
    expect(addEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(getReadyState).toHaveBeenCalledTimes(2);
  });

  test("登録中にloadedmetadataが即時発火しても二重解決せずtrueで終了すること", async () => {
    let readyStateValue = 0;
    const getReadyState = vi.fn(() => readyStateValue);
    const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
      // リスナー登録直後にloadedmetadataが発火した状況を再現する
      if (eventName === "loadedmetadata") {
        readyStateValue = 1;
        listener(new Event("loadedmetadata"));
      }
    });
    const removeEventListener = vi.fn();
    const videoElement = {
      get readyState() {
        return getReadyState();
      },
      addEventListener,
      removeEventListener,
    } as unknown as HTMLVideoElement;

    await expect(waitForLoadedMetadata(videoElement)).resolves.toBe(true);
    expect(addEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(getReadyState).toHaveBeenCalledTimes(2);
  });

  test("リスナー登録後にloadedmetadataが来た場合はtrueで終了すること", async () => {
    const listeners: Partial<Record<"loadedmetadata" | "error", EventListener>> = {};
    const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
      if (eventName === "loadedmetadata" || eventName === "error") listeners[eventName] = listener;
    });
    const removeEventListener = vi.fn();
    const videoElement = {
      readyState: 0,
      addEventListener,
      removeEventListener,
    } as unknown as HTMLVideoElement;

    const pending = waitForLoadedMetadata(videoElement);
    listeners.loadedmetadata?.(new Event("loadedmetadata"));

    await expect(pending).resolves.toBe(true);
    expect(removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("リスナー登録後にerrorが来た場合はfalseで終了すること", async () => {
    const listeners: Partial<Record<"loadedmetadata" | "error", EventListener>> = {};
    const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
      if (eventName === "loadedmetadata" || eventName === "error") listeners[eventName] = listener;
    });
    const removeEventListener = vi.fn();
    const videoElement = {
      readyState: 0,
      addEventListener,
      removeEventListener,
    } as unknown as HTMLVideoElement;

    const pending = waitForLoadedMetadata(videoElement);
    listeners.error?.(new Event("error"));

    await expect(pending).resolves.toBe(false);
    expect(removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("loadedmetadata後にerrorが来ても初回結果を維持し二重解決しないこと", async () => {
    const listeners: Partial<Record<"loadedmetadata" | "error", EventListener>> = {};
    const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
      if (eventName === "loadedmetadata" || eventName === "error") listeners[eventName] = listener;
    });
    const removeEventListener = vi.fn();
    const videoElement = {
      readyState: 0,
      addEventListener,
      removeEventListener,
    } as unknown as HTMLVideoElement;

    const pending = waitForLoadedMetadata(videoElement);
    const loadedmetadataListener = listeners.loadedmetadata;
    const errorListener = listeners.error;
    loadedmetadataListener?.(new Event("loadedmetadata"));
    errorListener?.(new Event("error"));

    await expect(pending).resolves.toBe(true);
    expect(removeEventListener).toHaveBeenCalledTimes(2);
  });

  test("タイムアウトした場合はfalseで終了すること", async () => {
    vi.useFakeTimers();
    try {
      const listeners: Partial<Record<"loadedmetadata" | "error", EventListener>> = {};
      const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
        if (eventName === "loadedmetadata" || eventName === "error") listeners[eventName] = listener;
      });
      const removeEventListener = vi.fn();
      const videoElement = {
        readyState: 0,
        addEventListener,
        removeEventListener,
      } as unknown as HTMLVideoElement;

      const pending = waitForLoadedMetadata(videoElement, 10);
      await vi.advanceTimersByTimeAsync(10);

      await expect(pending).resolves.toBe(false);
      expect(removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    } finally {
      vi.useRealTimers();
    }
  });
});
