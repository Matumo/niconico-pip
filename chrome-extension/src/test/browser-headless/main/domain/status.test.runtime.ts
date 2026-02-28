/**
 * statusドメインのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// statusランタイムテスト中に保持する収集状態インターフェース
interface StatusRuntimeState {
  eventName: string;
  observedEvents: AppEventMap["VideoInfoChanged"][];
  baselineEventCount: number;
  listener: EventListener;
}

// テスト実行間で共有するランタイム状態
let statusRuntimeState: StatusRuntimeState | null = null;

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

// VideoInfoChanged payloadの最小構造を判定する関数
const isVideoInfoChangedPayload = (value: unknown): value is AppEventMap["VideoInfoChanged"] => {
  if (!isObjectRecord(value)) return false;
  return isNullableString(value.title) &&
    isNullableString(value.author) &&
    isNullableString(value.thumbnail) &&
    typeof value.pageGeneration === "number" &&
    typeof value.infoGeneration === "number";
};

// 収集済みの最新イベントを取得するヘルパー関数
const getLatestObservedEvent = (
  observedEvents: AppEventMap["VideoInfoChanged"][],
): AppEventMap["VideoInfoChanged"] | null => {
  const latestEvent = observedEvents.at(-1);
  return latestEvent ?? null;
};

// 収集リスナーを解除して状態をクリアする関数
const clearState = (): void => {
  if (!statusRuntimeState) return;
  globalThis.removeEventListener(statusRuntimeState.eventName, statusRuntimeState.listener);
  statusRuntimeState = null;
};

// イベント収集を初期化する関数
const initializeState = (): HeadlessBridgeDetails => {
  clearState();

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).VideoInfoChanged;
  const observedEvents: AppEventMap["VideoInfoChanged"][] = [];

  // 収集対象イベントだけを履歴に積む関数
  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<unknown>;
    if (isVideoInfoChangedPayload(customEvent.detail)) {
      observedEvents.push(customEvent.detail);
    }
  };

  globalThis.addEventListener(eventName, listener as EventListener);
  statusRuntimeState = {
    eventName,
    observedEvents,
    baselineEventCount: observedEvents.length,
    listener: listener as EventListener,
  };

  return {
    commandRecognized: true,
    runtimeInitialized: statusRuntimeState !== null,
    eventNameAvailable: eventName.trim() !== "",
  };
};

// 直近ベースライン以降にイベントが増えていないことを確認する関数
const checkNoEvent = (): HeadlessBridgeDetails => {
  const state = statusRuntimeState;
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
  const state = statusRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedTitle = resolveNullableStringDetail(request, "expectedTitle");
  const expectedAuthor = resolveNullableStringDetail(request, "expectedAuthor");
  const expectedThumbnail = resolveNullableStringDetail(request, "expectedThumbnail");
  const expectedFieldsSpecified = expectedTitle !== undefined &&
    expectedAuthor !== undefined &&
    expectedThumbnail !== undefined;
  if (!expectedFieldsSpecified) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedFieldsSpecified: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  const latestEvent = getLatestObservedEvent(state.observedEvents);
  const previousEvent = baselineBefore > 0 ? state.observedEvents[baselineBefore - 1] : null;

  const newEventObservedSinceBaseline = observedCount > baselineBefore;
  const latestEventAvailable = latestEvent !== null;
  const latestEventHasPageGeneration = typeof latestEvent?.pageGeneration === "number";
  const latestEventHasInfoGeneration = typeof latestEvent?.infoGeneration === "number";
  const latestEventTitleMatchedExpected = latestEvent?.title === expectedTitle;
  const latestEventAuthorMatchedExpected = latestEvent?.author === expectedAuthor;
  const latestEventThumbnailMatchedExpected = latestEvent?.thumbnail === expectedThumbnail;
  const infoGenerationIncreasedFromPrevious = latestEvent !== null &&
    (previousEvent === null || latestEvent.infoGeneration > previousEvent.infoGeneration);
  const shouldAdvanceBaseline = newEventObservedSinceBaseline &&
    latestEventAvailable &&
    latestEventHasPageGeneration &&
    latestEventHasInfoGeneration &&
    latestEventTitleMatchedExpected &&
    latestEventAuthorMatchedExpected &&
    latestEventThumbnailMatchedExpected &&
    infoGenerationIncreasedFromPrevious;
  if (shouldAdvanceBaseline) {
    state.baselineEventCount = observedCount;
  }

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedFieldsSpecified: true,
    newEventObservedSinceBaseline,
    latestEventAvailable,
    latestEventHasPageGeneration,
    latestEventHasInfoGeneration,
    latestEventTitleMatchedExpected,
    latestEventAuthorMatchedExpected,
    latestEventThumbnailMatchedExpected,
    infoGenerationIncreasedFromPrevious,
  };
};

// PageUrlChangedイベントを明示的に発火する関数
const emitPageUrlChanged = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = statusRuntimeState;
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

// 収集状態を明示的に破棄する関数
const resetState = (): HeadlessBridgeDetails => {
  const wasInitialized = statusRuntimeState !== null;
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
  if (command === "emitPageUrlChanged") return emitPageUrlChanged(request);
  if (command === "reset") return resetState();

  return {
    commandRecognized: false,
  };
};

// エクスポート
export { runTest };
