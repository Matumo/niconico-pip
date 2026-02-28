/**
 * elementsドメインのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// elementsランタイムテスト中に保持する収集状態インターフェース
interface ElementsRuntimeState {
  eventName: string;
  observedEvents: AppEventMap["ElementsUpdated"][];
  baselineEventCount: number;
  listener: EventListener;
}

// テスト実行間で共有するランタイム状態
let elementsRuntimeState: ElementsRuntimeState | null = null;

// オブジェクト判定ヘルパー関数
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

// request.detailsから文字列配列を取り出すヘルパー関数
const resolveStringArrayDetail = (request: HeadlessBridgeRequest, key: string): string[] | null => {
  const details = request.details;
  if (!details || !isObjectRecord(details)) return null;
  const value = details[key];
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  return value;
};

// ElementsUpdated payloadの最小構造を判定する関数
const isElementsUpdatedPayload = (value: unknown): value is AppEventMap["ElementsUpdated"] => {
  if (!isObjectRecord(value)) return false;
  const pageGeneration = value.pageGeneration;
  const elementsGeneration = value.elementsGeneration;
  const changedKeys = value.changedKeys;
  const snapshot = value.snapshot;

  return typeof pageGeneration === "number"
    && typeof elementsGeneration === "number"
    && Array.isArray(changedKeys)
    && changedKeys.every((key) => typeof key === "string")
    && isObjectRecord(snapshot);
};

// 収集済みの最新イベントを取得するヘルパー関数
const getLatestObservedEvent = (
  observedEvents: AppEventMap["ElementsUpdated"][],
): AppEventMap["ElementsUpdated"] | null => {
  const latestEvent = observedEvents.at(-1);
  return latestEvent ?? null;
};

// 収集リスナーを解除して状態をクリアする関数
const clearState = (): void => {
  if (!elementsRuntimeState) return;
  globalThis.removeEventListener(elementsRuntimeState.eventName, elementsRuntimeState.listener);
  elementsRuntimeState = null;
};

// イベント収集を初期化する関数
const initializeState = (): HeadlessBridgeDetails => {
  clearState();

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).ElementsUpdated;
  const observedEvents: AppEventMap["ElementsUpdated"][] = [];

  // 収集対象イベントだけを履歴に積む関数
  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<unknown>;
    if (isElementsUpdatedPayload(customEvent.detail)) {
      observedEvents.push(customEvent.detail);
    }
  };

  globalThis.addEventListener(eventName, listener as EventListener);
  elementsRuntimeState = {
    eventName,
    observedEvents,
    baselineEventCount: observedEvents.length,
    listener: listener as EventListener,
  };

  return {
    commandRecognized: true,
    runtimeInitialized: elementsRuntimeState !== null,
    eventNameAvailable: eventName.trim() !== "",
  };
};

// 直近ベースライン以降にイベントが増えていないことを確認する関数
const checkNoEvent = (): HeadlessBridgeDetails => {
  const state = elementsRuntimeState;
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

// changedKeysが期待集合と一致するか判定する関数
const hasExactlyExpectedChangedKeys = (
  observedChangedKeys: readonly string[],
  expectedChangedKeys: readonly string[],
): boolean =>
  observedChangedKeys.length === expectedChangedKeys.length
  && expectedChangedKeys.every((key) => observedChangedKeys.includes(key));

// 直近ベースライン以降に新規イベントが増えたことを確認する関数
const checkNewEvent = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = elementsRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedChangedKeys = resolveStringArrayDetail(request, "expectedChangedKeys");
  if (!expectedChangedKeys) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedChangedKeysSpecified: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  const latestEvent = getLatestObservedEvent(state.observedEvents);

  const latestChangedKeys = latestEvent?.changedKeys ?? [];
  const changedKeysMatchedExpected = hasExactlyExpectedChangedKeys(latestChangedKeys, expectedChangedKeys);
  const snapshot = latestEvent?.snapshot;
  const snapshotHasExpectedKeys = snapshot !== undefined && expectedChangedKeys.every((key) => key in snapshot);
  const newEventObservedSinceBaseline = observedCount > baselineBefore;
  const latestEventAvailable = latestEvent !== null;
  const latestEventHasPageGeneration = typeof latestEvent?.pageGeneration === "number";
  const latestEventHasElementsGeneration = typeof latestEvent?.elementsGeneration === "number";
  const latestEventChangedKeysNotEmpty = latestChangedKeys.length > 0;
  const shouldAdvanceBaseline = newEventObservedSinceBaseline
    && latestEventAvailable
    && latestEventHasPageGeneration
    && latestEventHasElementsGeneration
    && latestEventChangedKeysNotEmpty
    && changedKeysMatchedExpected
    && snapshotHasExpectedKeys;
  if (shouldAdvanceBaseline) {
    state.baselineEventCount = observedCount;
  }

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedChangedKeysSpecified: true,
    newEventObservedSinceBaseline,
    latestEventAvailable,
    latestEventHasPageGeneration,
    latestEventHasElementsGeneration,
    latestEventChangedKeysNotEmpty,
    latestEventChangedKeysMatchedExpected: changedKeysMatchedExpected,
    latestEventSnapshotHasExpectedKeys: snapshotHasExpectedKeys,
  };
};

// PageUrlChangedイベントを明示的に発火する関数
const emitPageUrlChanged = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = elementsRuntimeState;
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
  const wasInitialized = elementsRuntimeState !== null;
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
