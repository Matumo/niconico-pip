/**
 * PiP動画要素 loadedmetadata待機アダプターのランタイムテスト
 */
import { waitForLoadedMetadata } from "@main/adapter/media/pip-video-element-loaded-metadata";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const createReadyStateControlledVideoElement = (
  initialReadyState: number,
): {
  videoElement: HTMLVideoElement;
  getReadyState: () => number;
  setReadyState: (nextReadyState: number) => void;
} => {
  const videoElement = globalThis.document.createElement("video");
  let currentReadyState = initialReadyState;
  Object.defineProperty(videoElement, "readyState", {
    configurable: true,
    get: () => currentReadyState,
  });

  return {
    videoElement,
    getReadyState: () => currentReadyState,
    setReadyState: (nextReadyState: number) => {
      currentReadyState = nextReadyState;
    },
  };
};

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const immediateReady = createReadyStateControlledVideoElement(1);
  const immediateReadyResolved = await waitForLoadedMetadata(immediateReady.videoElement);

  const transitioned = createReadyStateControlledVideoElement(0);
  const originalTransitionedAddEventListener = transitioned.videoElement.addEventListener.bind(transitioned.videoElement);
  transitioned.videoElement.addEventListener = ((...params: Parameters<typeof originalTransitionedAddEventListener>) => {
    // リスナー登録中に準備済みへ遷移したケースを再現する
    transitioned.setReadyState(1);
    return originalTransitionedAddEventListener(...params);
  }) as HTMLVideoElement["addEventListener"];
  const transitionedResolved = await waitForLoadedMetadata(transitioned.videoElement);
  transitioned.videoElement.addEventListener = originalTransitionedAddEventListener;

  const success = createReadyStateControlledVideoElement(0);
  const successPending = waitForLoadedMetadata(success.videoElement);
  success.videoElement.dispatchEvent(new Event("loadedmetadata"));
  const successResolved = await successPending;

  const error = createReadyStateControlledVideoElement(0);
  const errorPending = waitForLoadedMetadata(error.videoElement);
  error.videoElement.dispatchEvent(new Event("error"));
  const errorResolved = await errorPending;

  const settleFirstResult = createReadyStateControlledVideoElement(0);
  const settleFirstPending = waitForLoadedMetadata(settleFirstResult.videoElement);
  settleFirstResult.videoElement.dispatchEvent(new Event("loadedmetadata"));
  settleFirstResult.videoElement.dispatchEvent(new Event("error"));
  const settleFirstResolved = await settleFirstPending;

  const timeoutCase = createReadyStateControlledVideoElement(0);
  const timeoutResolved = await waitForLoadedMetadata(timeoutCase.videoElement, 10);

  return {
    immediateReadyResolved: immediateReadyResolved === true,
    transitionedResolved: transitionedResolved === true,
    transitionedReadyStateUpdated: transitioned.getReadyState() === 1,
    loadedmetadataResolved: successResolved === true,
    errorResolved: errorResolved === false,
    settleFirstResultPreserved: settleFirstResolved === true,
    timeoutResolvedAsFalse: timeoutResolved === false,
  };
};

// エクスポート
export { runTest };
