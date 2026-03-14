/**
 * PiP動画要素アダプターのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createPipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";
let runtimeElementSequence = 0;

const waitForCondition = async (
  condition: () => boolean,
  timeoutMs = 1200,
): Promise<boolean> => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (condition()) return true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 16));
  }
  return condition();
};

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const config = createAppConfig();
  let runtimeElementId: string;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    runtimeElementId = `${config.pipVideoElementId}-runtime-${globalThis.crypto.randomUUID()}`;
  } else {
    runtimeElementSequence += 1;
    runtimeElementId = `${config.pipVideoElementId}-runtime-${runtimeElementSequence}`;
  }
  const host = globalThis.document.createElement("div");
  const firstTarget = globalThis.document.createElement("div");
  const secondTarget = globalThis.document.createElement("div");
  const secondTargetExistingChild = globalThis.document.createElement("div");
  const staleElement = globalThis.document.createElement("video");
  staleElement.id = runtimeElementId;
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  firstTarget.style.display = "block";
  firstTarget.style.width = "640px";
  firstTarget.style.height = "360px";
  secondTarget.style.display = "block";
  secondTarget.style.width = "320px";
  secondTarget.style.height = "180px";
  secondTargetExistingChild.dataset.niconicoPipMarker = "existing-second-target-child";
  host.appendChild(firstTarget);
  host.appendChild(secondTarget);
  secondTarget.appendChild(secondTargetExistingChild);
  globalThis.document.body.appendChild(staleElement);
  globalThis.document.body.appendChild(host);

  const adapter = createPipVideoElementAdapter({
    elementId: runtimeElementId,
    canvasWidth: config.videoPipCanvasWidth,
    canvasHeight: config.videoPipCanvasHeight,
  });

  try {
    const staleElementResolvedBeforeInsert = globalThis.document.getElementById(runtimeElementId) === staleElement;
    const inserted = adapter.updatePipVideoPlacement(firstTarget);
    const pipVideoElement = adapter.getElement();
    const insertedAsFirstChild = firstTarget.firstElementChild === pipVideoElement;
    const staleElementRemovedOnInsert = !staleElement.isConnected;
    const ownElementResolvedByIdAfterInsert = globalThis.document.getElementById(runtimeElementId) === pipVideoElement;
    const pipVideoElementWithPipApi = pipVideoElement as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    };
    const stream = pipVideoElement.srcObject;
    const startsWithoutMediaStream = stream === null;

    const initialSizeApplied = await waitForCondition(
      () => pipVideoElement.style.width === "640px" && pipVideoElement.style.height === "360px",
    );

    firstTarget.style.width = "320px";
    firstTarget.style.height = "180px";
    const resizeObserverTracked = await waitForCondition(
      () => pipVideoElement.style.width === "320px" && pipVideoElement.style.height === "180px",
    );

    const movedToSecondTarget = adapter.updatePipVideoPlacement(secondTarget);
    const movedToSecondTargetAsFirstChild = secondTarget.firstElementChild === pipVideoElement;
    const existingChildMovedBehindPip = secondTarget.children.item(1) === secondTargetExistingChild;
    const removedFromFirstTargetOnMove = !firstTarget.contains(pipVideoElement);
    const singlePipNodeAfterMove = globalThis.document.querySelectorAll(`#${runtimeElementId}`).length === 1;
    const movedSizeApplied = await waitForCondition(
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
    const removedAfterStop = pipVideoElement.parentElement === null &&
      firstTarget.firstElementChild !== pipVideoElement &&
      secondTarget.firstElementChild !== pipVideoElement;
    const notFoundByIdAfterStop = globalThis.document.getElementById(runtimeElementId) === null;
    const srcObjectUntouchedAfterStop = pipVideoElement.srcObject === stream;

    return {
      inserted,
      insertedAsFirstChild,
      staleElementResolvedBeforeInsert,
      staleElementRemovedOnInsert,
      ownElementResolvedByIdAfterInsert,
      startsWithoutMediaStream,
      updatedSize: initialSizeApplied,
      resizeObserverTracked,
      movedToSecondTarget,
      movedToSecondTargetAsFirstChild,
      existingChildMovedBehindPip,
      removedFromFirstTargetOnMove,
      singlePipNodeAfterMove,
      movedSizeApplied,
      updatePosterSucceeded: updatePosterResult === true,
      posterClearedOnNull: clearPosterResult === false,
      posterSet: posterSetBeforeClear,
      posterCleared,
      ownByEventTarget,
      foreignByEventTargetDetected: foreignByEventTarget === false,
      ownByDocumentStateWhenNotInPip,
      requestPictureInPictureHandled,
      requestPictureInPictureAttempted,
      srcObjectUntouchedAfterStop,
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
