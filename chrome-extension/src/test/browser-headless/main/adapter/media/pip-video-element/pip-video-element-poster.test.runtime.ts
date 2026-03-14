/**
 * PiP動画要素 poster変換アダプターのランタイムテスト
 */
import { createPosterDataUrlCache } from "@main/adapter/media/pip-video-element/pip-video-element-poster-cache";
import { getPosterDataUrl } from "@main/adapter/media/pip-video-element/pip-video-element-poster";
import {
  isPipVideoElementPosterTestScenario,
  type PipVideoElementPosterTestScenario,
} from "@test/browser-headless/main/adapter/media/pip-video-element/pip-video-element-poster.test-scenario";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrM0AAAAASUVORK5CYII=";
const nonImageDataUrl = "data:text/plain;base64,SGVsbG8sIHBvc3RlciB0ZXN0";
let posterScenarioSequence = 0;
type PosterRuntimeGlobal = typeof globalThis & {
  Image?: typeof Image;
};

interface CreateElementDocumentLike {
  createElement(tagName: string, options?: ElementCreationOptions): Element;
}

interface ControlledImageEnvironment {
  flushPendingLoads(): void;
  getCreatedCount(): number;
  getSrcValues(): string[];
  restore(): void;
}

type ControlledImageMode =
  | "passthrough"
  | "manualSuccess"
  | "failOnceThenSuccess";

const resolveScenario = (request: HeadlessBridgeRequest): PipVideoElementPosterTestScenario => {
  const scenario = request.details?.scenario;
  if (!isPipVideoElementPosterTestScenario(scenario)) {
    throw new TypeError(`invalid pip-video-element-poster runtime test scenario: ${String(scenario)}`);
  }
  return scenario;
};

const assertNeverScenario = (scenario: never): never => {
  throw new TypeError(`unsupported pip-video-element-poster runtime test scenario: ${String(scenario)}`);
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

const resolveRuntimeImageCtor = (): typeof Image => {
  const browserGlobal = globalThis as PosterRuntimeGlobal;
  const ImageCtor = browserGlobal.Image;
  if (typeof ImageCtor !== "function") {
    throw new TypeError("runtime image constructor is unavailable");
  }
  return ImageCtor;
};

const getPosterDataUrlWithFreshCache = (thumbnailUrl: string): Promise<string> =>
  getPosterDataUrl({
    thumbnailUrl,
    posterDataUrlCache: createPosterDataUrlCache({
      maxEntries: 3,
    }),
  });

const createSharedPosterDataUrlCache = () => createPosterDataUrlCache({
  maxEntries: 3,
});

const createFixtureImageUrl = (search = ""): string =>
  `${globalThis.location.origin}/assets/tiny.png${search}`;

const createMissingFixtureImageUrl = (): string =>
  `${globalThis.location.origin}/assets/not-found-${++posterScenarioSequence}.png`;

const installControlledImageEnvironment = (
  mode: ControlledImageMode,
): ControlledImageEnvironment => {
  const browserGlobal = globalThis as PosterRuntimeGlobal;
  const RealImage = resolveRuntimeImageCtor();
  const imageGlobal = browserGlobal as { Image?: typeof Image };
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  const srcSetterCandidate = srcDescriptor?.set;
  const srcGetterCandidate = srcDescriptor?.get;
  if (!srcSetterCandidate || !srcGetterCandidate) {
    throw new TypeError("image src accessors are unavailable");
  }
  const setImageSrc = (image: HTMLImageElement, src: string): void => {
    srcSetterCandidate.call(image, src);
  };
  const getImageSrc = (image: HTMLImageElement): string =>
    srcGetterCandidate.call(image);

  let createdCount = 0;
  let failedOnce = false;
  const pendingLoads: Array<{ image: HTMLImageElement; src: string }> = [];
  const srcValues: string[] = [];

  class ControlledImage extends RealImage {
    constructor(width?: number, height?: number) {
      super(width, height);
      createdCount += 1;
    }

    set src(value: string) {
      srcValues.push(value);
      if (mode === "manualSuccess") {
        pendingLoads.push({
          image: this,
          src: value,
        });
        return;
      }

      if (mode === "failOnceThenSuccess" && !failedOnce) {
        failedOnce = true;
        const onError = this.onerror as ((event?: Event) => unknown) | null;
        globalThis.queueMicrotask(() => {
          onError?.(new Event("error"));
        });
        return;
      }

      setImageSrc(this, value);
    }

    get src(): string {
      return getImageSrc(this);
    }
  }

  imageGlobal.Image = ControlledImage as unknown as typeof Image;

  return {
    flushPendingLoads: (): void => {
      const currentPendingLoads = [...pendingLoads];
      pendingLoads.length = 0;
      for (const { image, src } of currentPendingLoads) {
        setImageSrc(image, src);
      }
    },
    getCreatedCount: (): number => createdCount,
    getSrcValues: (): string[] => [...srcValues],
    restore: (): void => {
      imageGlobal.Image = RealImage;
    },
  };
};

const loadImageDimensions = async (src: string): Promise<{
  height: number;
  width: number;
}> => {
  const ImageCtor = resolveRuntimeImageCtor();
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      reject(new Error("generated poster image load failed"));
    };
    image.src = src;
  });
};

const createSourceImageDataUrl = (params: {
  height: number;
  width: number;
}): string => {
  const canvasElement = globalThis.document.createElement("canvas");
  if (!(canvasElement instanceof HTMLCanvasElement)) {
    throw new TypeError("runtime source canvas creation failed");
  }
  canvasElement.width = params.width;
  canvasElement.height = params.height;

  const context = canvasElement.getContext("2d");
  if (!context) {
    throw new TypeError("runtime source canvas context is unavailable");
  }

  context.fillStyle = "#ff0000";
  context.fillRect(0, 0, params.width, params.height);
  return canvasElement.toDataURL();
};

const runBasicScenario = async (): Promise<HeadlessBridgeDetails> => {
  const converted = await getPosterDataUrlWithFreshCache(tinyPngDataUrl);
  const fixtureImageConverted = await getPosterDataUrlWithFreshCache(createFixtureImageUrl());
  const invalidImageUrlRejected = await expectRejected(
    getPosterDataUrlWithFreshCache(createMissingFixtureImageUrl()),
  );
  const nonImageDataRejected = await expectRejected(
    getPosterDataUrlWithFreshCache(nonImageDataUrl),
  );

  const browserGlobal = globalThis as PosterRuntimeGlobal;
  const imageGlobal = browserGlobal as { Image?: typeof Image };
  const originalImage = imageGlobal.Image;
  const imageUnavailableHandled = await (async () => {
    try {
      imageGlobal.Image = undefined;
      await getPosterDataUrlWithFreshCache(tinyPngDataUrl);
      return false;
    } catch (error: unknown) {
      return error instanceof TypeError;
    } finally {
      imageGlobal.Image = originalImage;
    }
  })();

  const canvasUnavailableHandled = await (async () => {
    const documentNode = globalThis.document as unknown as CreateElementDocumentLike;
    const originalCreateElement = documentNode.createElement.bind(documentNode);
    try {
      Object.defineProperty(documentNode, "createElement", {
        configurable: true,
        value: ((tagName: string, options?: ElementCreationOptions) => {
          if (tagName === "canvas") {
            return originalCreateElement("div");
          }
          return originalCreateElement(tagName, options);
        }) as CreateElementDocumentLike["createElement"],
      });
      await getPosterDataUrlWithFreshCache(tinyPngDataUrl);
      return false;
    } catch (error: unknown) {
      return error instanceof TypeError;
    } finally {
      Object.defineProperty(documentNode, "createElement", {
        configurable: true,
        value: originalCreateElement,
      });
    }
  })();

  return {
    convertedToDataUrl: converted.startsWith("data:"),
    fixtureImageConvertedToDataUrl: fixtureImageConverted.startsWith("data:"),
    invalidImageUrlRejected,
    nonImageDataRejected,
    imageUnavailableHandled,
    canvasUnavailableHandled,
  };
};

const runOfflineFailureScenario = async (): Promise<HeadlessBridgeDetails> => {
  const offlineNetworkFailureRejected = await expectRejected(
    getPosterDataUrlWithFreshCache(createFixtureImageUrl(`?offline=${++posterScenarioSequence}`)),
  );
  return {
    offlineNetworkFailureRejected,
  };
};

const runKeyNormalizationCacheHitScenario = async (): Promise<HeadlessBridgeDetails> => {
  const controlledImageEnvironment = installControlledImageEnvironment("passthrough");
  const posterDataUrlCache = createSharedPosterDataUrlCache();
  const firstThumbnailUrl = createFixtureImageUrl("?key=aaa&foo=1");
  const secondThumbnailUrl = createFixtureImageUrl("?foo=1&key=bbb");

  try {
    const firstResolve = getPosterDataUrl({
      thumbnailUrl: firstThumbnailUrl,
      posterDataUrlCache,
    });
    const firstPosterDataUrl = await firstResolve;
    const secondResolve = getPosterDataUrl({
      thumbnailUrl: secondThumbnailUrl,
      posterDataUrlCache,
    });
    const secondPosterDataUrl = await secondResolve;

    return {
      firstPosterConvertedToDataUrl: firstPosterDataUrl.startsWith("data:"),
      secondPosterConvertedToDataUrl: secondPosterDataUrl.startsWith("data:"),
      sharedResolvedPromise: secondResolve === firstResolve,
      singleImageCreated: controlledImageEnvironment.getCreatedCount() === 1,
      singleSrcAssignment: controlledImageEnvironment.getSrcValues().length === 1,
    };
  } finally {
    controlledImageEnvironment.restore();
  }
};

const runSharedPendingPromiseScenario = async (): Promise<HeadlessBridgeDetails> => {
  const controlledImageEnvironment = installControlledImageEnvironment("manualSuccess");
  const posterDataUrlCache = createSharedPosterDataUrlCache();
  const firstThumbnailUrl = createFixtureImageUrl("?key=aaa");
  const secondThumbnailUrl = createFixtureImageUrl("?key=bbb");

  try {
    const firstResolve = getPosterDataUrl({
      thumbnailUrl: firstThumbnailUrl,
      posterDataUrlCache,
    });
    const secondResolve = getPosterDataUrl({
      thumbnailUrl: secondThumbnailUrl,
      posterDataUrlCache,
    });

    const sharedPendingPromise = secondResolve === firstResolve;
    const singleImageCreatedBeforeFlush = controlledImageEnvironment.getCreatedCount() === 1;
    const singleSrcAssignmentBeforeFlush = controlledImageEnvironment.getSrcValues().length === 1;

    controlledImageEnvironment.flushPendingLoads();

    const firstPosterDataUrl = await firstResolve;
    const secondPosterDataUrl = await secondResolve;
    return {
      firstPosterConvertedToDataUrl: firstPosterDataUrl.startsWith("data:"),
      secondPosterConvertedToDataUrl: secondPosterDataUrl.startsWith("data:"),
      sharedPendingPromise,
      singleImageCreatedBeforeFlush,
      singleSrcAssignmentBeforeFlush,
    };
  } finally {
    controlledImageEnvironment.restore();
  }
};

const runRetryAfterFailureScenario = async (): Promise<HeadlessBridgeDetails> => {
  const controlledImageEnvironment = installControlledImageEnvironment("failOnceThenSuccess");
  const posterDataUrlCache = createSharedPosterDataUrlCache();
  const firstThumbnailUrl = createFixtureImageUrl("?key=aaa");
  const secondThumbnailUrl = createFixtureImageUrl("?key=bbb");

  try {
    const firstRejected = await expectRejected(getPosterDataUrl({
      thumbnailUrl: firstThumbnailUrl,
      posterDataUrlCache,
    }));
    const secondPosterDataUrl = await getPosterDataUrl({
      thumbnailUrl: secondThumbnailUrl,
      posterDataUrlCache,
    });
    const srcValues = controlledImageEnvironment.getSrcValues();

    return {
      firstRejected,
      retriedWithFreshImage: controlledImageEnvironment.getCreatedCount() === 2,
      secondPosterConvertedToDataUrl: secondPosterDataUrl.startsWith("data:"),
      bothAttemptsObserved: srcValues.length === 2,
      secondAttemptUsedSecondUrl: srcValues[1] === secondThumbnailUrl,
    };
  } finally {
    controlledImageEnvironment.restore();
  }
};

const runOutputIs16By9Scenario = async (): Promise<HeadlessBridgeDetails> => {
  const sourceImageDataUrl = createSourceImageDataUrl({
    width: 1600,
    height: 1200,
  });
  const posterDataUrl = await getPosterDataUrlWithFreshCache(sourceImageDataUrl);
  const outputDimensions = await loadImageDimensions(posterDataUrl);

  return {
    posterConvertedToDataUrl: posterDataUrl.startsWith("data:"),
    outputWidthPreserved: outputDimensions.width === 1600,
    outputHeightCroppedTo16By9: outputDimensions.height === 900,
    outputAspectRatioIs16By9: outputDimensions.width * 9 === outputDimensions.height * 16,
  };
};

const runTest = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  const scenario = resolveScenario(request);

  switch (scenario) {
    case "basic":
      return runBasicScenario();
    case "offlineFailure":
      return runOfflineFailureScenario();
    case "keyNormalizationCacheHit":
      return runKeyNormalizationCacheHitScenario();
    case "sharedPendingPromise":
      return runSharedPendingPromiseScenario();
    case "retryAfterFailure":
      return runRetryAfterFailureScenario();
    case "outputIs16By9":
      return runOutputIs16By9Scenario();
    default:
      return assertNeverScenario(scenario);
  };
};

// エクスポート
export { runTest };
