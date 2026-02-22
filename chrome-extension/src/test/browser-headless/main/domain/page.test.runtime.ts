/**
 * pageドメインのランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// pageランタイムテスト中に保持する収集状態インターフェース
interface PageRuntimeState {
  eventName: string;
  observedEvents: AppEventMap["PageUrlChanged"][];
  baselineEventCount: number;
  listener: EventListener;
}

// テスト実行間で共有するランタイム状態
let pageRuntimeState: PageRuntimeState | null = null;

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

// 収集済みの最新イベントを取得するヘルパー関数
const getLatestObservedEvent = (
  observedEvents: AppEventMap["PageUrlChanged"][],
): AppEventMap["PageUrlChanged"] | null => {
  const latestEvent = observedEvents.at(-1);
  return latestEvent ?? null;
};

// 収集リスナーを解除して状態をクリアする関数
const clearState = (): void => {
  if (!pageRuntimeState) return;
  globalThis.removeEventListener(pageRuntimeState.eventName, pageRuntimeState.listener);
  pageRuntimeState = null;
};

// イベント収集を初期化する関数
const initializeState = (): HeadlessBridgeDetails => {
  clearState();

  const config = createAppConfig();
  const eventName = createAppEventNameMap(config.prefixId).PageUrlChanged;
  const observedEvents: AppEventMap["PageUrlChanged"][] = [];

  // 収集対象イベントだけを履歴に積む関数
  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<AppEventMap["PageUrlChanged"]>;
    if (customEvent.detail && typeof customEvent.detail.url === "string"
        && typeof customEvent.detail.generation === "number") {
      observedEvents.push(customEvent.detail);
    }
  };

  globalThis.addEventListener(eventName, listener as EventListener);
  pageRuntimeState = {
    eventName,
    observedEvents,
    baselineEventCount: observedEvents.length,
    listener: listener as EventListener,
  };

  return {
    commandRecognized: true,
    runtimeInitialized: pageRuntimeState !== null,
    eventNameAvailable: eventName.trim() !== "",
  };
};

// 直近ベースライン以降にイベントが増えていないことを確認する関数
const checkNoEvent = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pageRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedUrl = resolveStringDetail(request, "expectedUrl");
  if (!expectedUrl) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedUrlSpecified: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  state.baselineEventCount = observedCount;

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedUrlSpecified: true,
    currentUrlMatchedExpected: globalThis.location.href === expectedUrl,
    noNewEventSinceBaseline: observedCount === baselineBefore,
  };
};

// 直近ベースライン以降に新規イベントが増えたことを確認する関数
const checkNewEvent = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const state = pageRuntimeState;
  if (!state) {
    return {
      commandRecognized: true,
      runtimeInitialized: false,
    };
  }

  const expectedUrl = resolveStringDetail(request, "expectedUrl");
  if (!expectedUrl) {
    return {
      commandRecognized: true,
      runtimeInitialized: true,
      expectedUrlSpecified: false,
    };
  }

  const baselineBefore = state.baselineEventCount;
  const observedCount = state.observedEvents.length;
  const latestEvent = getLatestObservedEvent(state.observedEvents);
  const previousEvent = baselineBefore > 0 ? state.observedEvents[baselineBefore - 1] : null;
  state.baselineEventCount = observedCount;

  return {
    commandRecognized: true,
    runtimeInitialized: true,
    expectedUrlSpecified: true,
    currentUrlMatchedExpected: globalThis.location.href === expectedUrl,
    newEventObservedSinceBaseline: observedCount > baselineBefore,
    latestEventUrlMatchedExpected: latestEvent?.url === expectedUrl,
    latestEventHasGeneration: typeof latestEvent?.generation === "number",
    generationIncreasedFromPrevious: latestEvent !== null &&
      (previousEvent === null || latestEvent.generation > previousEvent.generation),
  };
};

// 収集状態を明示的に破棄する関数
const resetState = (): HeadlessBridgeDetails => {
  const wasInitialized = pageRuntimeState !== null;
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
  if (command === "checkNoEvent") return checkNoEvent(request);
  if (command === "checkNewEvent") return checkNewEvent(request);
  if (command === "reset") return resetState();

  return {
    commandRecognized: false,
  };
};

// エクスポート
export { runTest };
