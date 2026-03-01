/**
 * PiP動画要素アダプターのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createPipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";

const waitForCondition = async (
  condition: () => boolean,
  timeoutMs = 1200,
): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 16));
  }
  return condition();
};

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const config = createAppConfig();
  const runtimeElementId = `${config.pipVideoElementId}-runtime-${Date.now()}`;
  const host = globalThis.document.createElement("div");
  const target = globalThis.document.createElement("div");
  const staleElement = globalThis.document.createElement("video");
  staleElement.id = runtimeElementId;
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  target.style.display = "block";
  target.style.width = "640px";
  target.style.height = "360px";
  host.appendChild(target);
  globalThis.document.body.appendChild(staleElement);
  globalThis.document.body.appendChild(host);

  const adapter = createPipVideoElementAdapter({
    elementId: runtimeElementId,
    canvasWidth: config.videoPipCanvasWidth,
    canvasHeight: config.videoPipCanvasHeight,
  });

  try {
    const staleElementResolvedBeforeInsert = globalThis.document.getElementById(runtimeElementId) === staleElement;
    const inserted = adapter.ensureInserted(target);
    const pipVideoElement = adapter.getElement();
    const insertedAsFirstChild = target.firstElementChild === pipVideoElement;
    const staleElementRemovedOnInsert = !staleElement.isConnected;
    const ownElementResolvedByIdAfterInsert = globalThis.document.getElementById(runtimeElementId) === pipVideoElement;
    const pipVideoElementWithPipApi = pipVideoElement as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    };
    const stream = pipVideoElement.srcObject;
    const hasInitialMediaStream = stream instanceof MediaStream;

    const initialSizeApplied = await waitForCondition(
      () => pipVideoElement.style.width === "640px" && pipVideoElement.style.height === "360px",
    );

    target.style.width = "320px";
    target.style.height = "180px";
    const resizeObserverTracked = await waitForCondition(
      () => pipVideoElement.style.width === "320px" && pipVideoElement.style.height === "180px",
    );

    const updatePosterResult = await adapter.updatePoster(tinyPngDataUrl);
    const posterSetBeforeClear = (pipVideoElement.getAttribute("poster") ?? "").startsWith("data:");
    const clearPosterResult = await adapter.updatePoster(null);
    const posterCleared = pipVideoElement.getAttribute("poster") === null;

    const ownByEventTarget = adapter.isOwnPictureInPictureElement(pipVideoElement);
    const foreignByEventTarget = adapter.isOwnPictureInPictureElement(globalThis.document.createElement("video"));
    const ownByDocumentStateWhenNotInPip = adapter.isOwnPictureInPictureElement() === false;

    let requestPictureInPictureHandled = false;
    let requestPictureInPictureAttempted = false;
    const originalRequestPictureInPicture = pipVideoElementWithPipApi.requestPictureInPicture;
    try {
      if (typeof originalRequestPictureInPicture === "function") {
        pipVideoElementWithPipApi.requestPictureInPicture = async () => {
          requestPictureInPictureAttempted = true;
          return originalRequestPictureInPicture.call(pipVideoElementWithPipApi);
        };
      }

      const requestPromise = adapter.requestPictureInPicture();
      globalThis.setTimeout(() => {
        pipVideoElement.dispatchEvent(new Event("loadedmetadata"));
      }, 0);
      const pipRequestResult = await requestPromise;
      requestPictureInPictureHandled = typeof pipRequestResult === "boolean";
      if (typeof originalRequestPictureInPicture !== "function") {
        requestPictureInPictureAttempted = pipRequestResult === false;
      }
    } catch {
      requestPictureInPictureHandled = false;
      requestPictureInPictureAttempted = false;
    } finally {
      pipVideoElementWithPipApi.requestPictureInPicture = originalRequestPictureInPicture;
    }

    adapter.stop();
    const tracksEndedAfterStop = stream instanceof MediaStream &&
      stream.getTracks().every((track) => track.readyState === "ended");
    const removedAfterStop = pipVideoElement.parentElement === null &&
      target.firstElementChild !== pipVideoElement;
    const notFoundByIdAfterStop = globalThis.document.getElementById(runtimeElementId) === null;

    return {
      inserted,
      insertedAsFirstChild,
      staleElementResolvedBeforeInsert,
      staleElementRemovedOnInsert,
      ownElementResolvedByIdAfterInsert,
      hasInitialMediaStream,
      updatedSize: initialSizeApplied,
      resizeObserverTracked,
      updatePosterSucceeded: updatePosterResult === true,
      posterClearedOnNull: clearPosterResult === false,
      posterSet: posterSetBeforeClear,
      posterCleared,
      ownByEventTarget,
      foreignByEventTargetDetected: foreignByEventTarget === false,
      ownByDocumentStateWhenNotInPip,
      requestPictureInPictureHandled,
      requestPictureInPictureAttempted,
      tracksEndedAfterStop,
      removedAfterStop,
      notFoundByIdAfterStop,
    };
  } finally {
    staleElement.remove();
    host.remove();
  }
};

// エクスポート
export { runTest };
