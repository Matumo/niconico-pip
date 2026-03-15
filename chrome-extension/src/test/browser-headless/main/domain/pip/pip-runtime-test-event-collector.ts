/**
 * pipドメインbrowser-headlessランタイムイベント収集
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// pipランタイムテスト中に保持する収集状態インターフェース
interface PipRuntimeEventCollectorState {
  eventName: string;
  observedEvents: AppEventMap["PipStatusChanged"][];
  baselineEventCount: number;
  listener: EventListener;
  nativePipEvents: string[];
  nativePipEventBaselineCount: number;
  nativePipEventListener: EventListener;
}

// オブジェクト判定ヘルパー関数
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// PipStatusChanged payloadの最小構造を判定する関数
const isPipStatusChangedPayload = (value: unknown): value is AppEventMap["PipStatusChanged"] => {
  if (!isObjectRecord(value)) return false;
  const changedKeys = value.changedKeys;
  return typeof value.enabled === "boolean" &&
    Array.isArray(changedKeys) &&
    changedKeys.every((key) => typeof key === "string");
};

// 収集済みの最新イベントを取得するヘルパー関数
const getLatestObservedEvent = (
  observedEvents: AppEventMap["PipStatusChanged"][],
): AppEventMap["PipStatusChanged"] | null => {
  const latestEvent = observedEvents.at(-1);
  return latestEvent ?? null;
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

// テスト実行間で共有する収集状態
let collectorState: PipRuntimeEventCollectorState | null = null;

// 収集リスナーを解除して状態をクリアする関数
const clearCollectorState = (): void => {
  if (!collectorState) return;
  globalThis.removeEventListener(collectorState.eventName, collectorState.listener);
  globalThis.removeEventListener("enterpictureinpicture", collectorState.nativePipEventListener);
  globalThis.removeEventListener("leavepictureinpicture", collectorState.nativePipEventListener);
  collectorState = null;
};

// イベント収集を初期化する関数
const initializePipRuntimeEventCollector = (): HeadlessBridgeDetails => {
  clearCollectorState();

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
  collectorState = {
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
    runtimeInitialized: collectorState !== null,
    eventNameAvailable: eventName.trim() !== "",
  };
};

// collector状態を取得する関数
const getPipRuntimeEventCollectorState = (): PipRuntimeEventCollectorState | null => collectorState;

// 直近ベースライン以降のnative PiPイベント列を検証する関数
const checkNewNativePipEventSequence = (
  expectedSequence: string[] | null,
): HeadlessBridgeDetails => {
  const state = collectorState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

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
const checkNoNewPipStatusChanged = (): HeadlessBridgeDetails => {
  const state = collectorState;
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
const checkNewPipStatusChanged = (
  expectedEnabled: boolean | null,
): HeadlessBridgeDetails => {
  const state = collectorState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

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

// 収集状態を明示的に破棄する関数
const resetPipRuntimeEventCollector = (): HeadlessBridgeDetails => {
  const wasInitialized = collectorState !== null;
  clearCollectorState();
  return {
    commandRecognized: true,
    runtimeReset: true,
    runtimeWasInitialized: wasInitialized,
  };
};

// エクスポート
export {
  initializePipRuntimeEventCollector,
  getPipRuntimeEventCollectorState,
  checkNewNativePipEventSequence,
  checkNoNewPipStatusChanged,
  checkNewPipStatusChanged,
  resetPipRuntimeEventCollector,
};
export type { PipRuntimeEventCollectorState };
