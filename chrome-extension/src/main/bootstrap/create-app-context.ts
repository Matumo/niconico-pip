/**
 * アプリコンテキスト生成
 */
import { createAppEventNameMap } from "@main/config/event";
import { mergeHttpPolicy, type HttpPolicyOverrides } from "@main/config/http";
import { selectorDefinitions } from "@main/config/selector";
import { createElementResolver, type QueryRoot } from "@main/platform/element-resolver";
import { createEventRegistry } from "@main/platform/event-registry";
import { createHttpClient } from "@main/platform/http/http-client";
import { createObserverRegistry, type CreateObserverRegistryOptions } from "@main/platform/observer-registry";
import type { AppConfig } from "@main/config/config";
import type { AppContext, AppStateStore } from "@main/types/app-context";

// createAppContextで受け取る必須依存型
interface CreateAppContextDependencies {
  config: AppConfig;
}

// createAppContextの入力型
interface CreateAppContextOptions {
  root?: QueryRoot;
  fetchFn?: typeof fetch;
  randomFn?: () => number;
  httpPolicy?: HttpPolicyOverrides;
  createObserver?: CreateObserverRegistryOptions["createObserver"];
}

// 実行環境に応じたルート要素を決定する関数
const resolveQueryRoot = (rootOverride?: QueryRoot): QueryRoot => {
  // 明示注入があれば最優先で採用
  if (rootOverride) return rootOverride;

  // ブラウザ実行時はdocumentをルートとして利用
  const candidate = (globalThis as { document?: unknown }).document;
  const canUseDocumentAsRoot =
    typeof candidate === "object" && candidate !== null && "querySelector" in candidate &&
    typeof (candidate as { querySelector?: unknown }).querySelector === "function";
  if (canUseDocumentAsRoot) return candidate as QueryRoot;

  // 非DOM環境では常にnullを返すダミーを返す
  return {
    querySelector: () => null,
  };
};

// 実行時依存を束ねたアプリコンテキストを作成する関数
const createAppContext = (
  state: AppStateStore,
  dependencies: CreateAppContextDependencies,
  options: CreateAppContextOptions = {},
): AppContext => {
  const config = dependencies.config;

  // レジストリを初期化
  const eventRegistry = createEventRegistry(createAppEventNameMap(config.prefixId));
  const observerRegistry = createObserverRegistry({
    createObserver: options.createObserver,
  });

  // ルート要素を決定
  const root = resolveQueryRoot(options.root);

  // 要素リゾルバーを初期化
  const elementResolver = createElementResolver({
    root,
    getPageGeneration: () => state.page.get().generation,
    definitions: selectorDefinitions,
  });

  // HTTPクライアントを初期化
  const httpPolicy = mergeHttpPolicy(options.httpPolicy);
  const httpClient = createHttpClient({
    policy: httpPolicy,
    fetchFn: options.fetchFn,
    randomFn: options.randomFn,
  });

  return {
    config,
    eventRegistry,
    observerRegistry,
    state,
    elementResolver,
    httpClient,
  };
};

// エクスポート
export { createAppContext };
export type { CreateAppContextDependencies, CreateAppContextOptions };
