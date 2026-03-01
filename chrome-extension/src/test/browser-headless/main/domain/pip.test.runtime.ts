/**
 * pipドメインのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// pipランタイムテスト中に保持する収集状態インターフェース
interface PipRuntimeState {
  eventName: string;
  observedEvents: AppEventMap["PipStatusChanged"][];
  baselineEventCount: number;
  listener: EventListener;
  nativePipEvents: string[];
  nativePipEventBaselineCount: number;
  nativePipEventListener: EventListener;
}

// テスト実行間で共有するランタイム状態
let pipRuntimeState: PipRuntimeState | null = null;

// オブジェクト判定ヘルパー関数
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// nullable文字列判定ヘルパー関数
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

// request.detailsから文字列値を取り出すヘルパー関数
const resolveStringDetail = (request: HeadlessBridgeRequest, key: string): string | null => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return null;
  const value = details[key];
  return typeof value === "string" ? value : null;
};

// request.detailsから数値を取り出すヘルパー関数
const resolveNumberDetail = (request: HeadlessBridgeRequest, key: string): number | null => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return null;
  const value = details[key];
  return typeof value === "number" ? value : null;
};

// request.detailsから真偽値を取り出すヘルパー関数
const resolveBooleanDetail = (request: HeadlessBridgeRequest, key: string): boolean | null => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return null;
  const value = details[key];
  return typeof value === "boolean" ? value : null;
};

// request.detailsからnullable文字列値を取り出すヘルパー関数
const resolveNullableStringDetail = (request: HeadlessBridgeRequest, key: string): string | null | undefined => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return undefined;
  if (!(key in details)) return undefined;
  const value = details[key];
  return isNullableString(value) ? value : undefined;
};

// request.detailsから文字列配列を取り出すヘルパー関数
const resolveStringArrayDetail = (request: HeadlessBridgeRequest, key: string): string[] | null => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return null;
  const value = details[key];
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  return value;
};

// PipStatusChanged payloadの最小構造を判定する関数
const isPipStatusChangedPayload = (value: unknown): value is AppEventMap["PipStatusChanged"] => {
  if (!isObjectRecord(value)) return false;
  return typeof value.enabled === "boolean";
};

// 収集済みの最新イベントを取得するヘルパー関数
const getLatestObservedEvent = (
  observedEvents: AppEventMap["PipStatusChanged"][],
): AppEventMap["PipStatusChanged"] | null => {
  const latestEvent = observedEvents.at(-1);
  return latestEvent ?? null;
};

// 収集リスナーを解除して状態をクリアする関数
const clearState = (): void => {
  if (!pipRuntimeState) return;
  globalThis.removeEventListener(pipRuntimeState.eventName, pipRuntimeState.listener);
  globalThis.removeEventListener("enterpictureinpicture", pipRuntimeState.nativePipEventListener);
  globalThis.removeEventListener("leavepictureinpicture", pipRuntimeState.nativePipEventListener);
  pipRuntimeState = null;
};

// native PiPイベントtarget種別を文字列化する関数
const resolveNativeEventTargetKind = (target: EventTarget | null): string => {
  const config = createAppConfig();
  const pipVideoElement = globalThis.document.getElementById(config.pipVideoElementId);
  if (pipVideoElement instanceof HTMLVideoElement && target === pipVideoElement) {
    return "pipVideoElement";
  }
  if (target === globalThis) return "window";
  if (target instanceof HTMLVideoElement) return "videoElement";
  if (!target) return "null";
  return "other";
};

// cleanupを伴う単回解決関数を作るヘルパー関数
const createSingleSettle = <T>(
  cleanup: () => void,
  resolve: (value: T) => void,
): ((value: T) => void) => {
  let settled = false;
  return (value: T): void => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(value);
  };
};

// 動画要素のreadyStateがmetadata取得済みになるまで待機する関数
const waitForVideoReady = async (
  videoElement: HTMLVideoElement,
  timeoutMs = 1500,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (videoElement.readyState >= 1) {
      resolve(true);
      return;
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const cleanup = (): void => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("error", handleError);
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const settle = createSingleSettle<boolean>(cleanup, resolve);
    const handleLoadedMetadata = (): void => {
      settle(videoElement.readyState >= 1);
    };
    const handleError = (): void => {
      settle(false);
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("error", handleError);
    timeoutId = globalThis.setTimeout(() => {
      settle(videoElement.readyState >= 1);
    }, timeoutMs);

    if (videoElement.readyState >= 1) settle(true);
  });

// 指定要素がPicture-in-Picture有効になるまで待機する関数
const waitForPictureInPictureElement = async (
  targetVideoElement: HTMLVideoElement,
  timeoutMs = 1200,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (globalThis.document.pictureInPictureElement === targetVideoElement) {
      resolve(true);
      return;
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const cleanup = (): void => {
      globalThis.removeEventListener("enterpictureinpicture", handleEnterPictureInPicture);
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const settle = createSingleSettle<boolean>(cleanup, resolve);
    const handleEnterPictureInPicture = (event: Event): void => {
      if (event.target === targetVideoElement ||
          globalThis.document.pictureInPictureElement === targetVideoElement) {
        settle(true);
      }
    };

    globalThis.addEventListener("enterpictureinpicture", handleEnterPictureInPicture);
    timeoutId = globalThis.setTimeout(() => {
      settle(globalThis.document.pictureInPictureElement === targetVideoElement);
    }, timeoutMs);

    if (globalThis.document.pictureInPictureElement === targetVideoElement) settle(true);
  });

// foreign PiP奪取のイベント順序を評価する関数
const evaluateForeignTakeoverOrder = (observedSequence: string[]): {
  leaveAfterForeignEnter: boolean;
  ownEnterAfterLeave: boolean;
  takeoverOrderMatched: boolean;
} => {
  const foreignEnterIndex = observedSequence.indexOf("enterpictureinpicture:videoElement");
  const leaveIndex = observedSequence.findIndex(
    (entry, index) => index > foreignEnterIndex && entry.startsWith("leavepictureinpicture:"),
  );
  const ownEnterIndex = observedSequence.indexOf("enterpictureinpicture:pipVideoElement");
  const leaveAfterForeignEnter = foreignEnterIndex >= 0 && leaveIndex > foreignEnterIndex;
  const ownEnterAfterLeave = leaveIndex >= 0 && ownEnterIndex > leaveIndex;
  return {
    leaveAfterForeignEnter,
    ownEnterAfterLeave,
    takeoverOrderMatched: leaveAfterForeignEnter && ownEnterAfterLeave,
  };
};

// foreign PiP奪取のイベント順序が成立するまで待機する関数
const waitForForeignTakeoverOrder = async (
  state: PipRuntimeState,
  baselineIndex: number,
  timeoutMs = 1800,
): Promise<{
  leaveAfterForeignEnter: boolean;
  ownEnterAfterLeave: boolean;
  takeoverOrderMatched: boolean;
}> =>
  new Promise((resolve) => {
    const evaluate = () => evaluateForeignTakeoverOrder(state.nativePipEvents.slice(baselineIndex));
    const initial = evaluate();
    if (initial.takeoverOrderMatched) {
      resolve(initial);
      return;
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const cleanup = (): void => {
      globalThis.removeEventListener("enterpictureinpicture", handleNativePipEvent);
      globalThis.removeEventListener("leavepictureinpicture", handleNativePipEvent);
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const settle = createSingleSettle<{
      leaveAfterForeignEnter: boolean;
      ownEnterAfterLeave: boolean;
      takeoverOrderMatched: boolean;
    }>(cleanup, resolve);
    const handleNativePipEvent = (): void => {
      const result = evaluate();
      if (result.takeoverOrderMatched) settle(result);
    };

    globalThis.addEventListener("enterpictureinpicture", handleNativePipEvent);
    globalThis.addEventListener("leavepictureinpicture", handleNativePipEvent);
    timeoutId = globalThis.setTimeout(() => {
      settle(evaluate());
    }, timeoutMs);
  });

// 実PiPテスト用のstream付きvideo要素を作成する関数
const createStreamBackedVideoElement = (): HTMLVideoElement => {
  const videoElement = globalThis.document.createElement("video");
  videoElement.muted = true;
  videoElement.autoplay = true;
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "black";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  videoElement.srcObject = canvas.captureStream(1);
  return videoElement;
};

// イベント収集を初期化する関数
const initializeState = (): HeadlessBridgeDetails => {
  clearState();

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).PipStatusChanged;
  const observedEvents: AppEventMap["PipStatusChanged"][] = [];
  const nativePipEvents: string[] = [];

  // 収集対象イベントだけを履歴に積む関数
  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<unknown>;
    if (isPipStatusChangedPayload(customEvent.detail)) {
      observedEvents.push(customEvent.detail);
    }
  };
  const nativePipEventListener = (event: Event): void => {
    if (event.type !== "enterpictureinpicture" && event.type !== "leavepictureinpicture") return;
    nativePipEvents.push(`${event.type}:${resolveNativeEventTargetKind(event.target)}`);
  };

  globalThis.addEventListener(eventName, listener as EventListener);
  globalThis.addEventListener("enterpictureinpicture", nativePipEventListener as EventListener);
  globalThis.addEventListener("leavepictureinpicture", nativePipEventListener as EventListener);
  pipRuntimeState = {
    eventName,
    observedEvents,
    baselineEventCount: observedEvents.length,
    listener: listener as EventListener,
    nativePipEvents,
    nativePipEventBaselineCount: nativePipEvents.length,
    nativePipEventListener: nativePipEventListener as EventListener,
  };

  return {
    commandRecognized: true,
    runtimeInitialized: pipRuntimeState !== null,
    eventNameAvailable: eventName.trim() !== "",
  };
};

// 直近ベースライン以降のnative PiPイベント列を検証する関数
const checkNewNativePipEventSequence = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedSequence = resolveStringArrayDetail(request, "expectedSequence");
  if (!expectedSequence) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedSequenceSpecified: false,
    };
  }

  const baselineBefore = state.nativePipEventBaselineCount;
  const observedSlice = state.nativePipEvents.slice(baselineBefore);
  const newEventObservedSinceBaseline = observedSlice.length > 0;

  let expectedSequenceIncludedInOrder = false;
  for (let startIndex = 0; startIndex <= observedSlice.length - expectedSequence.length; startIndex += 1) {
    const matched = expectedSequence.every(
      (value, index) => observedSlice[startIndex + index] === value,
    );
    if (matched) {
      expectedSequenceIncludedInOrder = true;
      break;
    }
  }

  if (expectedSequenceIncludedInOrder) {
    state.nativePipEventBaselineCount = state.nativePipEvents.length;
  }

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedSequenceSpecified: true,
    newEventObservedSinceBaseline,
    expectedSequenceIncludedInOrder,
  };
};

// 直近ベースライン以降にイベントが増えていないことを確認する関数
const checkNoEvent = (): HeadlessBridgeDetails => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  state.baselineEventCount = observedCount;

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    noNewEventSinceBaseline: observedCount === baselineBefore,
  };
};

// 直近ベースライン以降に新規イベントが増えたことを確認する関数
const checkNewEvent = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedEnabled = resolveBooleanDetail(request, "expectedEnabled");
  if (expectedEnabled === null) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedEnabledSpecified: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  const latestEvent = getLatestObservedEvent(state.observedEvents);
  const newEventObservedSinceBaseline = observedCount > baselineBefore;
  const latestEventAvailable = latestEvent !== null;
  const latestEventHasEnabled = typeof latestEvent?.enabled === "boolean";
  const latestEventEnabledMatchedExpected = latestEvent?.enabled === expectedEnabled;
  const shouldAdvanceBaseline = newEventObservedSinceBaseline &&
    latestEventAvailable &&
    latestEventHasEnabled &&
    latestEventEnabledMatchedExpected;
  if (shouldAdvanceBaseline) {
    state.baselineEventCount = observedCount;
  }

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedEnabledSpecified: true,
    newEventObservedSinceBaseline,
    latestEventAvailable,
    latestEventHasEnabled,
    latestEventEnabledMatchedExpected,
  };
};

// PageUrlChangedイベントを明示的に発火する関数
const emitPageUrlChanged = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const url = resolveStringDetail(request, "url");
  const generation = resolveNumberDetail(request, "generation");
  const isWatchPage = resolveBooleanDetail(request, "isWatchPage");
  if (!url || generation === null || isWatchPage === null) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pageUrlChangedUrlSpecified: !!url,
      pageUrlChangedGenerationSpecified: generation !== null,
      pageUrlChangedIsWatchPageSpecified: isWatchPage !== null,
    };
  }

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).PageUrlChanged;
  globalThis.dispatchEvent(new CustomEvent(eventName, {
    detail: {
      url,
      generation,
      isWatchPage,
    } satisfies AppEventMap["PageUrlChanged"],
  }));

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    pageUrlChangedUrlSpecified: true,
    pageUrlChangedGenerationSpecified: true,
    pageUrlChangedIsWatchPageSpecified: true,
    pageUrlChangedEventNameAvailable: eventName.trim() !== "",
    pageUrlChangedEventDispatched: true,
  };
};

// VideoInfoChangedイベントを明示的に発火する関数
const emitVideoInfoChanged = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const title = resolveNullableStringDetail(request, "title");
  const author = resolveNullableStringDetail(request, "author");
  const thumbnail = resolveNullableStringDetail(request, "thumbnail");
  const pageGeneration = resolveNumberDetail(request, "pageGeneration");
  const infoGeneration = resolveNumberDetail(request, "infoGeneration");
  const payloadReady = title !== undefined &&
    author !== undefined &&
    thumbnail !== undefined &&
    pageGeneration !== null &&
    infoGeneration !== null;
  if (!payloadReady) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      videoInfoChangedTitleSpecified: title !== undefined,
      videoInfoChangedAuthorSpecified: author !== undefined,
      videoInfoChangedThumbnailSpecified: thumbnail !== undefined,
      videoInfoChangedPageGenerationSpecified: pageGeneration !== null,
      videoInfoChangedInfoGenerationSpecified: infoGeneration !== null,
    };
  }

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).VideoInfoChanged;
  globalThis.dispatchEvent(new CustomEvent(eventName, {
    detail: {
      title,
      author,
      thumbnail,
      pageGeneration,
      infoGeneration,
    } satisfies AppEventMap["VideoInfoChanged"],
  }));

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    videoInfoChangedTitleSpecified: true,
    videoInfoChangedAuthorSpecified: true,
    videoInfoChangedThumbnailSpecified: true,
    videoInfoChangedPageGenerationSpecified: true,
    videoInfoChangedInfoGenerationSpecified: true,
    videoInfoChangedEventNameAvailable: eventName.trim() !== "",
    videoInfoChangedEventDispatched: true,
  };
};

type NativePipEventType = "enterpictureinpicture" | "leavepictureinpicture";
type NativePipTargetKind = "window" | "pipVideoElement";

// 入力文字列がサポート対象のPiPイベント種別か判定する関数
const isNativePipEventType = (value: string | null): value is NativePipEventType =>
  value === "enterpictureinpicture" || value === "leavepictureinpicture";

// 入力文字列がサポート対象のPiPイベントtarget種別か判定する関数
const isNativePipTargetKind = (value: string | null): value is NativePipTargetKind =>
  value === "window" || value === "pipVideoElement";

// native PiP dispatch結果で共通利用する成功系基本値を返す関数
const createNativePipDispatchBaseDetails = (): HeadlessBridgeDetails => ({
  commandRecognized: true,
  runtimeInitialized: true,
  eventTypeSpecified: true,
  eventTypeSupported: true,
  targetKindSpecified: true,
  targetKindSupported: true,
});

// native PiP dispatch入力不正時の詳細結果を返す関数
const createNativePipDispatchValidationDetails = (
  eventType: string | null,
  targetKind: string | null,
): HeadlessBridgeDetails => ({
  commandRecognized: true,
  runtimeInitialized: true,
  eventTypeSpecified: eventType !== null,
  eventTypeSupported: isNativePipEventType(eventType),
  targetKindSpecified: targetKind !== null,
  targetKindSupported: isNativePipTargetKind(targetKind),
});

// 実APIでPiP enter (target=pipVideoElement) を発火する関数
const dispatchNativePipEnterForPipVideoElement = async (): Promise<HeadlessBridgeDetails> => {
  const config = createAppConfig();
  const pipVideoElement = globalThis.document.getElementById(config.pipVideoElementId);
  if (!(pipVideoElement instanceof HTMLVideoElement)) {
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: false,
    };
  }

  const pipVideoReady = await waitForVideoReady(pipVideoElement);
  if (!pipVideoReady) {
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      pipVideoReady: false,
    };
  }

  await pipVideoElement.play().catch(() => undefined);
  try {
    await pipVideoElement.requestPictureInPicture();
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      pipVideoReady: true,
      pipRequestResolved: true,
    };
  } catch {
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      pipVideoReady: true,
      pipRequestResolved: false,
    };
  }
};

// 実APIでPiP leave (target=window) を発火する関数
const dispatchNativePipLeaveForWindow = async (): Promise<HeadlessBridgeDetails> => {
  const currentPipElement = globalThis.document.pictureInPictureElement;
  if (!currentPipElement) {
    // 既にPiP未有効なら、連続leave要求でも成功扱いで終了する
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      alreadyNoActivePip: true,
    };
  }

  try {
    await globalThis.document.exitPictureInPicture();
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      pipExitResolved: true,
    };
  } catch {
    return {
      ...createNativePipDispatchBaseDetails(),
      dispatchTargetResolved: true,
      realApiUsed: true,
      pipExitResolved: false,
    };
  }
};

// 実APIで直接再現不可な組み合わせ時の詳細結果を返す関数
const createUnsupportedNativePipDispatchDetails = (): HeadlessBridgeDetails => ({
  ...createNativePipDispatchBaseDetails(),
  realApiCombinationSupported: false,
});

// PiPネイティブイベントを明示的に発火する関数
const dispatchNativePipEvent = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  if (!pipRuntimeState) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const eventType = resolveStringDetail(request, "eventType");
  const targetKind = resolveStringDetail(request, "targetKind");
  if (!isNativePipEventType(eventType) || !isNativePipTargetKind(targetKind)) {
    return createNativePipDispatchValidationDetails(eventType, targetKind);
  }

  // このテストでは疑似イベントを禁止し、実APIで再現できる組み合わせのみ許可する
  if (eventType === "enterpictureinpicture" && targetKind === "pipVideoElement") {
    return dispatchNativePipEnterForPipVideoElement();
  }

  if (eventType === "leavepictureinpicture" && targetKind === "window") {
    return dispatchNativePipLeaveForWindow();
  }

  return createUnsupportedNativePipDispatchDetails();
};

// foreign PiP検知から拡張PiPへ奪取する流れを再現する関数
const simulateForeignPipTakeover = async (): Promise<HeadlessBridgeDetails> => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const config = createAppConfig();
  const pipVideoElement = globalThis.document.getElementById(config.pipVideoElementId);
  if (!(pipVideoElement instanceof HTMLVideoElement)) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: false,
    };
  }

  const foreignVideoElement = createStreamBackedVideoElement();
  const foreignVideoElementCreated = foreignVideoElement instanceof HTMLVideoElement;
  if (!foreignVideoElementCreated || !globalThis.document.body) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementCreated: false,
    };
  }

  const pipVideoReady = await waitForVideoReady(pipVideoElement);
  if (!pipVideoReady) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementCreated: true,
      pipVideoElementReady: false,
    };
  }

  await pipVideoElement.play().catch(() => undefined);
  const foreignVideoParent = globalThis.document.body;
  foreignVideoElement.style.position = "fixed";
  foreignVideoElement.style.left = "-10000px";
  foreignVideoElement.style.top = "-10000px";

  try {
    // foreign奪取シナリオを安定再現するため、先に拡張側PiPを有効化する
    await pipVideoElement.requestPictureInPicture().catch(() => undefined);
    const ownInitialPipActive = await waitForPictureInPictureElement(pipVideoElement, 1200);
    if (!ownInitialPipActive) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementCreated: true,
        pipVideoElementReady: true,
        ownInitialPipActive: false,
      };
    }

    const baselineBefore = state.nativePipEvents.length;
    foreignVideoParent.appendChild(foreignVideoElement);
    const foreignVideoReady = await waitForVideoReady(foreignVideoElement);
    if (!foreignVideoReady) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementCreated: true,
        pipVideoElementReady: true,
        ownInitialPipActive: true,
        foreignVideoElementReady: false,
      };
    }

    await foreignVideoElement.play().catch(() => undefined);
    const foreignRequestResolved = await foreignVideoElement.requestPictureInPicture()
      .then(() => true)
      .catch(() => false);
    if (!foreignRequestResolved) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementCreated: true,
        pipVideoElementReady: true,
        ownInitialPipActive: true,
        foreignVideoElementReady: true,
        foreignRequestResolved: false,
      };
    }

    const takeoverOrderStatus = await waitForForeignTakeoverOrder(state, baselineBefore, 1800);
    const leaveAfterForeignEnter = takeoverOrderStatus.leaveAfterForeignEnter;
    const ownEnterAfterLeave = takeoverOrderStatus.ownEnterAfterLeave;
    const takeoverOrderMatched = takeoverOrderStatus.takeoverOrderMatched;

    const ownPipBecameActive = globalThis.document.pictureInPictureElement === pipVideoElement;
    if (!takeoverOrderMatched || !ownPipBecameActive) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementCreated: true,
        pipVideoElementReady: true,
        ownInitialPipActive: true,
        foreignVideoElementReady: true,
        foreignRequestResolved: true,
        leaveAfterForeignEnter,
        ownEnterAfterLeave,
        takeoverOrderMatched,
        ownPipBecameActive,
      };
    }

    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementCreated: true,
      pipVideoElementReady: true,
      ownInitialPipActive: true,
      foreignVideoElementReady: true,
      foreignRequestResolved: true,
      leaveAfterForeignEnter: true,
      ownEnterAfterLeave: true,
      takeoverOrderMatched: true,
      ownPipBecameActive: true,
    };
  } finally {
    if (globalThis.document.pictureInPictureElement === foreignVideoElement) {
      await globalThis.document.exitPictureInPicture().catch(() => undefined);
    }
    foreignVideoElement.remove();
    await Promise.resolve();
  }
};

// foreign PiP連続検知時のin-flight抑止を検証する関数
const verifyForeignEnterInFlightGuard = async (): Promise<HeadlessBridgeDetails> => {
  const state = pipRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const config = createAppConfig();
  const pipVideoElement = globalThis.document.getElementById(config.pipVideoElementId);
  if (!(pipVideoElement instanceof HTMLVideoElement)) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: false,
    };
  }

  const foreignVideoElementA = createStreamBackedVideoElement();
  const foreignVideoElementB = createStreamBackedVideoElement();
  if (!globalThis.document.body) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementsCreated: false,
    };
  }

  const pipVideoReady = await waitForVideoReady(pipVideoElement);
  if (!pipVideoReady) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementsCreated: true,
      pipVideoElementReady: false,
    };
  }

  await pipVideoElement.play().catch(() => undefined);
  const foreignVideoParent = globalThis.document.body;
  foreignVideoElementA.style.position = "fixed";
  foreignVideoElementA.style.left = "-10000px";
  foreignVideoElementA.style.top = "-10000px";
  foreignVideoElementB.style.position = "fixed";
  foreignVideoElementB.style.left = "-10000px";
  foreignVideoElementB.style.top = "-10000px";

  type PictureInPictureCapableVideoElement = HTMLVideoElement & {
    requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
  };
  const pipVideoWithPipApi = pipVideoElement as PictureInPictureCapableVideoElement;
  const originalRequestPictureInPicture = pipVideoWithPipApi.requestPictureInPicture;
  if (typeof originalRequestPictureInPicture !== "function") {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementsCreated: true,
      pipVideoElementReady: true,
      pipRequestApiAvailable: false,
    };
  }

  let requestCallCount = 0;
  const firstRequestDeferred: {
    resolve?: (value: PictureInPictureWindow) => void;
    reject?: (reason?: unknown) => void;
  } = {};

  pipVideoWithPipApi.requestPictureInPicture = () => {
    requestCallCount += 1;
    if (requestCallCount === 1) {
      return new Promise<PictureInPictureWindow>((resolve, reject) => {
        firstRequestDeferred.resolve = resolve;
        firstRequestDeferred.reject = reject;
      });
    }
    return Promise.resolve({} as PictureInPictureWindow);
  };

  try {
    foreignVideoParent.appendChild(foreignVideoElementA);
    foreignVideoParent.appendChild(foreignVideoElementB);

    const foreignVideoAReady = await waitForVideoReady(foreignVideoElementA);
    const foreignVideoBReady = await waitForVideoReady(foreignVideoElementB);
    if (!foreignVideoAReady || !foreignVideoBReady) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementsCreated: true,
        pipVideoElementReady: true,
        pipRequestApiAvailable: true,
        foreignVideoAReady,
        foreignVideoBReady,
      };
    }

    await foreignVideoElementA.play().catch(() => undefined);
    const firstForeignRequestResolved = await foreignVideoElementA.requestPictureInPicture()
      .then(() => true)
      .catch(() => false);
    if (!firstForeignRequestResolved) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementsCreated: true,
        pipVideoElementReady: true,
        pipRequestApiAvailable: true,
        foreignVideoAReady: true,
        foreignVideoBReady: true,
        firstForeignRequestResolved: false,
      };
    }

    const firstRequestStarted = requestCallCount === 1;
    await foreignVideoElementB.play().catch(() => undefined);
    const secondForeignRequestResolved = await foreignVideoElementB.requestPictureInPicture()
      .then(() => true)
      .catch(() => false);
    if (!secondForeignRequestResolved) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementsCreated: true,
        pipVideoElementReady: true,
        pipRequestApiAvailable: true,
        foreignVideoAReady: true,
        foreignVideoBReady: true,
        firstForeignRequestResolved: true,
        firstRequestStarted,
        secondForeignRequestResolved: false,
      };
    }

    const secondEnterSuppressedWhileInFlight = requestCallCount === 1;
    const resolveFirstRequest = firstRequestDeferred.resolve;
    if (resolveFirstRequest) {
      resolveFirstRequest({} as PictureInPictureWindow);
    }
    firstRequestDeferred.reject = undefined;
    await Promise.resolve();

    const thirdForeignRequestResolved = await foreignVideoElementA.requestPictureInPicture()
      .then(() => true)
      .catch(() => false);
    if (!thirdForeignRequestResolved) {
      return {
        commandRecognized: true,
        runtimeInitialized: true,
        pipVideoElementResolved: true,
        foreignVideoElementsCreated: true,
        pipVideoElementReady: true,
        pipRequestApiAvailable: true,
        foreignVideoAReady: true,
        foreignVideoBReady: true,
        firstForeignRequestResolved: true,
        firstRequestStarted,
        secondForeignRequestResolved: true,
        secondEnterSuppressedWhileInFlight,
        thirdForeignRequestResolved: false,
      };
    }

    return {
      commandRecognized: true,
      runtimeInitialized: true,
      pipVideoElementResolved: true,
      foreignVideoElementsCreated: true,
      pipVideoElementReady: true,
      pipRequestApiAvailable: true,
      foreignVideoAReady: true,
      foreignVideoBReady: true,
      firstForeignRequestResolved: true,
      firstRequestStarted,
      secondForeignRequestResolved: true,
      secondEnterSuppressedWhileInFlight,
      thirdForeignRequestResolved: true,
      thirdEnterAcceptedAfterInFlightReleased: requestCallCount === 2,
    };
  } finally {
    const rejectFirstRequest = firstRequestDeferred.reject;
    if (rejectFirstRequest) {
      rejectFirstRequest(new Error("verifyForeignEnterInFlightGuard cleanup"));
      firstRequestDeferred.reject = undefined;
    }
    pipVideoWithPipApi.requestPictureInPicture = originalRequestPictureInPicture;
    if (globalThis.document.pictureInPictureElement) {
      await globalThis.document.exitPictureInPicture().catch(() => undefined);
    }
    foreignVideoElementA.remove();
    foreignVideoElementB.remove();
    await Promise.resolve();
  }
};

// 収集状態を明示的に破棄する関数
const resetState = (): HeadlessBridgeDetails => {
  const wasInitialized = pipRuntimeState !== null;
  clearState();
  return {
    commandRecognized: true,
    runtimeReset: true,
    runtimeWasInitialized: wasInitialized,
  };
};

// ブリッジrequestのcommandに応じて処理を振り分ける関数
const runTest = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  const command = resolveStringDetail(request, "command");
  if (command === "init") return initializeState();
  if (command === "checkNoEvent") return checkNoEvent();
  if (command === "checkNewEvent") return checkNewEvent(request);
  if (command === "checkNewNativePipEventSequence") return checkNewNativePipEventSequence(request);
  if (command === "emitPageUrlChanged") return emitPageUrlChanged(request);
  if (command === "emitVideoInfoChanged") return emitVideoInfoChanged(request);
  if (command === "dispatchNativePipEvent") return dispatchNativePipEvent(request);
  if (command === "simulateForeignPipTakeover") return simulateForeignPipTakeover();
  if (command === "verifyForeignEnterInFlightGuard") return verifyForeignEnterInFlightGuard();
  if (command === "reset") return resetState();

  return {
    commandRecognized: false,
  };
};

// エクスポート
export { runTest };
