/**
 * pipドメインブラウザランタイムテスト
 */
import { createAppConfig } from "@main/config/config";
import { createAppEventNameMap, type AppEventMap } from "@main/config/event";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";
import {
  checkNoNewPipStatusChanged,
  getPipRuntimeEventCollectorState,
  initializePipRuntimeEventCollector,
  resetPipRuntimeEventCollector,
} from "@test/browser-headless/main/domain/pip/pip-runtime-test-event-collector";

const allowedCommands = new Set([
  "init",
  "checkNoEvent",
  "emitPageUrlChanged",
  "emitVideoInfoChanged",
  "reset",
]);

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

// PageUrlChangedイベントを明示的に発火する関数
const emitPageUrlChanged = (request: HeadlessBridgeRequest): HeadlessBridgeDetails => {
  const collectorState = getPipRuntimeEventCollectorState();
  if (!collectorState) {
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
      changedKeys: isWatchPage ? ["url"] : ["url", "isWatchPage"],
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
  const collectorState = getPipRuntimeEventCollectorState();
  if (!collectorState) {
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
      changedKeys: ["title", "author", "thumbnail"],
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

// pip公開入口シナリオに必要なコマンドだけを許可して実行する関数
const runTest = async (request: HeadlessBridgeRequest): Promise<HeadlessBridgeDetails> => {
  const command = resolveStringDetail(request, "command");
  if (!command || !allowedCommands.has(command)) {
    return {
      commandRecognized: false,
    };
  }
  if (command === "init") return initializePipRuntimeEventCollector();
  if (command === "checkNoEvent") return checkNoNewPipStatusChanged();
  if (command === "emitPageUrlChanged") return emitPageUrlChanged(request);
  if (command === "emitVideoInfoChanged") return emitVideoInfoChanged(request);
  if (command === "reset") return resetPipRuntimeEventCollector();

  return {
    commandRecognized: false,
  };
};

// エクスポート
export { runTest };
