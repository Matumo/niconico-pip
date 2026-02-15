/**
 * アプリコンテキスト型定義
 */
import type { AppConfig } from "@main/config/config";
import type { AppEventKey, AppEventMap } from "@main/config/event";
import type { SelectorElementMap, SelectorKey } from "@main/config/selector";
import type { Input as HttpInput, KyInstance, Options as HttpOptions, ResponsePromise } from "ky";
import type { Logger } from "@matumo/ts-simple-logger";

// イベント解除関数型
type Unsubscribe = () => void;

// 再生状態型
type PlaybackStatus = "idle" | "loading" | "ready" | "error";

// ページ状態型
interface PageState {
  url: string;
  isWatchPage: boolean;
  generation: number;
}

// 要素状態型
interface ElementsState {
  lastResolvedGeneration: number;
  lastResolvedAt: number | null;
}

// ステータス状態型
interface StatusState {
  playbackStatus: PlaybackStatus;
}

// 時刻状態型
interface TimeState {
  currentTime: number;
  duration: number;
}

// PiP状態型
interface PipState {
  enabled: boolean;
  reason: "user" | "system" | "unknown";
}

// 動画情報状態型
interface InfoState {
  title: string | null;
  videoId: string | null;
}

// state sliceインターフェース型
interface AppStateSlice<TState> {
  // 現在stateを取得する関数
  get(): Readonly<TState>;
}

// state更新writerインターフェース型
interface AppStateWriter<TState> {
  // stateを置換する関数
  set(nextState: TState): void;
  // stateを部分更新する関数
  patch(partialState: Partial<TState>): void;
  // 初期stateへ戻す関数
  reset(): void;
}

// 全体stateストア型
interface AppStateStore {
  page: AppStateSlice<PageState>;
  elements: AppStateSlice<ElementsState>;
  status: AppStateSlice<StatusState>;
  time: AppStateSlice<TimeState>;
  pip: AppStateSlice<PipState>;
  info: AppStateSlice<InfoState>;
}

// 全体state更新writer集合型
interface AppStateWriters {
  page: AppStateWriter<PageState>;
  elements: AppStateWriter<ElementsState>;
  status: AppStateWriter<StatusState>;
  time: AppStateWriter<TimeState>;
  pip: AppStateWriter<PipState>;
  info: AppStateWriter<InfoState>;
}

// アプリで利用するロガー集合型
interface AppLoggers {
  main: Logger;
  bootstrap: Logger;
  domain: Logger;
  elementResolver: Logger;
  http: Logger;
  safeRunner: Logger;
}

// イベントレジストリインターフェース型
interface AppEventRegistry {
  on<K extends AppEventKey>(params: {
    target: EventTarget;
    key: string;
    eventKey: K;
    listener: (payload: AppEventMap[K]) => void;
    options?: AddEventListenerOptions;
  }): Unsubscribe;
  emit<K extends AppEventKey>(params: {
    target: EventTarget;
    eventKey: K;
    payload: AppEventMap[K];
  }): void;
  off(key: string): boolean;
  clear(): void;
  size(): number;
}

// オブザーバーレジストリインターフェース型
interface AppObserverRegistry {
  observe(params: {
    key: string;
    target: Node;
    callback: MutationCallback;
    options: MutationObserverInit;
  }): MutationObserver;
  disconnect(key: string): boolean;
  disconnectAll(): void;
  size(): number;
}

// HTTPクライアントインターフェース型
interface AppHttpClient {
  // kyクライアント本体
  client: KyInstance;
  // 汎用リクエスト関数
  request<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // GETリクエスト関数
  get<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // POSTリクエスト関数
  post<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // PUTリクエスト関数
  put<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // PATCHリクエスト関数
  patch<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // DELETEリクエスト関数
  delete<TData = unknown>(input: HttpInput, options?: HttpOptions): ResponsePromise<TData>;
  // HEADリクエスト関数
  head(input: HttpInput, options?: HttpOptions): ResponsePromise<unknown>;
  // 互換APIとしてキャッシュクリアを提供する関数
  clearCache(): void;
  // 互換APIとしてin-flightクリアを提供する関数
  clearInFlight(): void;
}

// 要素リゾルバーインターフェース型
interface AppElementResolver {
  resolve<K extends SelectorKey>(key: K): SelectorElementMap[K] | null;
  peek<K extends SelectorKey>(key: K): SelectorElementMap[K] | null;
  invalidate(key: SelectorKey): void;
  invalidateAll(): void;
}

// 実行時依存を束ねるアプリコンテキスト型
interface AppContext {
  config: AppConfig;
  loggers: AppLoggers;
  eventRegistry: AppEventRegistry;
  observerRegistry: AppObserverRegistry;
  state: AppStateStore;
  elementResolver: AppElementResolver;
  httpClient: AppHttpClient;
}

// エクスポート
export type {
  Unsubscribe,
  PlaybackStatus,
  PageState,
  ElementsState,
  StatusState,
  TimeState,
  PipState,
  InfoState,
  AppStateSlice,
  AppStateWriter,
  AppStateStore,
  AppStateWriters,
  AppLoggers,
  AppEventRegistry,
  AppObserverRegistry,
  AppHttpClient,
  AppElementResolver,
  AppContext,
};
