/**
 * PiP動画要素 poster変換アダプターのランタイムテスト
 */
import { makePoster16By9 } from "@main/adapter/media/pip-video-element-poster";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";
const nonImageDataUrl = "data:text/plain;base64,SGVsbG8sIHBvc3RlciB0ZXN0";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const resolveBooleanDetail = (request: HeadlessBridgeRequest, key: string): boolean => {
  if (!isObjectRecord(request.details)) return false;
  return request.details[key] === true;
};

const expectRejected = async (
  promise: Promise<unknown>,
): Promise<boolean> => {
  try {
    await promise;
    return false;
  } catch {
    return true;
  }
};

const runTest = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  const checkOfflineFailure = resolveBooleanDetail(request, "checkOfflineFailure");

  const converted = await makePoster16By9(tinyPngDataUrl, globalThis.document);
  const fixtureImageUrl = `${globalThis.location.origin}/assets/tiny.png`;
  const fixtureImageConvertedToDataUrl = checkOfflineFailure ? true : await (async () => {
    const fixtureImageConverted = await makePoster16By9(fixtureImageUrl, globalThis.document);
    return fixtureImageConverted.startsWith("data:");
  })();
  const invalidImageUrlRejected = checkOfflineFailure ? true : await expectRejected(
    makePoster16By9(`${globalThis.location.origin}/assets/not-found-${Date.now()}.png`, globalThis.document),
  );
  const nonImageDataRejected = checkOfflineFailure ? true : await expectRejected(
    makePoster16By9(nonImageDataUrl, globalThis.document),
  );

  const originalImage = (globalThis as { Image?: typeof Image }).Image;
  const imageUnavailableHandled = await (async () => {
    try {
      (globalThis as { Image?: typeof Image }).Image = undefined;
      await makePoster16By9(tinyPngDataUrl, globalThis.document);
      return false;
    } catch (error: unknown) {
      return error instanceof TypeError;
    } finally {
      (globalThis as { Image?: typeof Image }).Image = originalImage;
    }
  })();

  const canvasUnavailableHandled = await (async () => {
    try {
      await makePoster16By9(tinyPngDataUrl, {
        createElement: () => globalThis.document.createElement("div"),
      });
      return false;
    } catch (error: unknown) {
      return error instanceof TypeError;
    }
  })();

  let offlineNetworkFailureRejected = true;
  if (checkOfflineFailure) {
    offlineNetworkFailureRejected = await expectRejected(
      makePoster16By9(`${globalThis.location.origin}/assets/tiny.png?offline=${Date.now()}`, globalThis.document),
    );
  }

  return {
    convertedToDataUrl: converted.startsWith("data:"),
    fixtureImageConvertedToDataUrl,
    invalidImageUrlRejected,
    nonImageDataRejected,
    imageUnavailableHandled,
    canvasUnavailableHandled,
    offlineNetworkFailureRejected,
  };
};

// エクスポート
export { runTest };
