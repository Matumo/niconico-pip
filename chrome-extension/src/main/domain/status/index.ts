/**
 * statusドメイン
 */
import { createVideoInfoAdapter, type VideoInfoAdapter, type VideoInfoSnapshot } from "@main/adapter/dom/video-info";
import type { AppEventMap } from "@main/config/event";
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { AppContext, AppStateWriters, Unsubscribe } from "@main/types/app-context";

// 動画情報同期の発火要因型
type VideoInfoSyncTrigger = "page-url-changed" | "elements-updated" | "initial-start";

// statusドメイン実行時に利用するランタイム依存型
interface StatusDomainRuntime {
  context: AppContext;
  stateWriters: AppStateWriters;
  videoInfoAdapter: VideoInfoAdapter;
  snapshot: VideoInfoSnapshot;
  infoGeneration: number;
  pageGeneration: number;
  unsubscribePageUrlChanged: Unsubscribe | null;
  unsubscribeElementsUpdated: Unsubscribe | null;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  dispatchEvent?: (event: Event) => boolean;
};

const log = getLogger(appLoggerNames.domain);

// 空の動画情報スナップショットを作る関数
const createEmptyVideoInfoSnapshot = (): VideoInfoSnapshot => ({
  title: null,
  author: null,
  thumbnail: null,
});

// globalThisをEventTargetとして扱えるか判定する関数
const resolveEventTarget = (): EventTarget | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  if (typeof browserGlobal.dispatchEvent !== "function") return null;
  return browserGlobal as unknown as EventTarget;
};

// 2つの動画情報スナップショットが一致するか判定する関数
const isSameVideoInfoSnapshot = (left: VideoInfoSnapshot, right: VideoInfoSnapshot): boolean =>
  left.title === right.title &&
  left.author === right.author &&
  left.thumbnail === right.thumbnail;

// VideoInfoChangedのpayloadを作成する関数
const createVideoInfoChangedPayload = (params: {
  snapshot: VideoInfoSnapshot;
  pageGeneration: number;
  infoGeneration: number;
}): AppEventMap["VideoInfoChanged"] =>
  Object.freeze({
    title: params.snapshot.title,
    author: params.snapshot.author,
    thumbnail: params.snapshot.thumbnail,
    pageGeneration: params.pageGeneration,
    infoGeneration: params.infoGeneration,
  });

// statusドメインを作成する関数
const createStatusDomain = (): DomainModule => {
  const baseDomain = createDomainModule("status", "coreDetection");
  // 実行時の情報
  let runtime: StatusDomainRuntime | null = null;

  // statusドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): StatusDomainRuntime | null => {
    if (!runtime) log.warn("status runtime is not initialized");
    return runtime;
  };

  // 動画情報の差分を確定してstate更新とイベント通知を行う関数
  const commitVideoInfo = (
    runtime: StatusDomainRuntime,
    nextSnapshot: VideoInfoSnapshot,
    trigger: VideoInfoSyncTrigger,
    forceSyncByPageGeneration = false,
  ): void => {
    const pageGeneration = runtime.context.state.page.get().generation;
    const snapshotChanged = !isSameVideoInfoSnapshot(runtime.snapshot, nextSnapshot);
    const pageGenerationChanged = runtime.pageGeneration !== pageGeneration;

    // NOTE: forceSyncByPageGeneration はページ境界を通知したいかどうかを示すフラグ。
    // trueのときはsnapshot差分がなくても、pageGenerationが変わっていれば同期を確定する。
    // PageUrlChanged起因の処理でtrueに設定されることを想定。
    if (!snapshotChanged && !(forceSyncByPageGeneration && pageGenerationChanged)) {
      log.debug(`video info unchanged (trigger=${trigger})`);
      return;
    }

    runtime.snapshot = nextSnapshot;
    runtime.pageGeneration = pageGeneration;
    runtime.infoGeneration += 1;

    runtime.stateWriters.info.patch({
      title: nextSnapshot.title,
      author: nextSnapshot.author,
      thumbnail: nextSnapshot.thumbnail,
      pageGeneration,
      infoGeneration: runtime.infoGeneration,
    });

    const eventTarget = resolveEventTarget();
    if (!eventTarget) {
      log.warn("VideoInfoChanged emit skipped: global event target is unavailable");
      return;
    }
    const payload = createVideoInfoChangedPayload({
      snapshot: runtime.snapshot,
      pageGeneration,
      infoGeneration: runtime.infoGeneration,
    });
    runtime.context.eventRegistry.emit({
      target: eventTarget,
      eventKey: "VideoInfoChanged",
      payload,
    });
    log.info(`video info updated (trigger=${trigger})`);
    log.debug("video info updated payload:", payload);
  };

  // 動画情報を再解決して同期する関数
  const syncVideoInfo = (
    trigger: VideoInfoSyncTrigger,
    options: {
      forceSyncByPageGeneration?: boolean;
      useEmptySnapshot?: boolean;
    } = {},
  ): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    const nextSnapshot = options.useEmptySnapshot
      ? createEmptyVideoInfoSnapshot() : runtime.videoInfoAdapter.resolve();
    commitVideoInfo(runtime, nextSnapshot, trigger, options.forceSyncByPageGeneration ?? false);
  };

  // PageUrlChanged通知を受けて動画情報同期を切り替える関数
  const handlePageUrlChanged = (payload: AppEventMap["PageUrlChanged"]): void => {
    if (!payload.isWatchPage) {
      // NOTE: 非watchページ遷移時は空スナップショット通知を1回出し、
      // 下流のメタ情報参照を同時にリセットできるようにする。
      syncVideoInfo("page-url-changed", {
        forceSyncByPageGeneration: true,
        useEmptySnapshot: true,
      });
      return;
    }

    syncVideoInfo("page-url-changed", {
      forceSyncByPageGeneration: true,
    });
  };

  // ElementsUpdated通知を受けて動画情報を再評価する関数
  const handleElementsUpdated = (_: AppEventMap["ElementsUpdated"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    const pageState = runtime.context.state.page.get();
    if (!pageState.isWatchPage) return;
    syncVideoInfo("elements-updated");
  };

  return {
    ...baseDomain,
    // statusドメインを初期化する関数
    init: async (nextContext, nextStateWriters): Promise<void> => {
      await baseDomain.init(nextContext, nextStateWriters);

      const videoInfoAdapter = createVideoInfoAdapter();

      let unsubscribePageUrlChanged: Unsubscribe | null = null;
      let unsubscribeElementsUpdated: Unsubscribe | null = null;
      const eventTarget = resolveEventTarget();
      if (eventTarget) {
        unsubscribePageUrlChanged = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:status:page-url-changed",
          eventKey: "PageUrlChanged",
          listener: (payload) => {
            handlePageUrlChanged(payload);
          },
        });
        unsubscribeElementsUpdated = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:status:elements-updated",
          eventKey: "ElementsUpdated",
          listener: (payload) => {
            handleElementsUpdated(payload);
          },
        });
      } else {
        log.warn("status event listen skipped: global event target is unavailable");
      }

      const infoState = nextContext.state.info.get();
      runtime = {
        context: nextContext,
        stateWriters: nextStateWriters,
        videoInfoAdapter,
        snapshot: {
          title: infoState.title,
          author: infoState.author,
          thumbnail: infoState.thumbnail,
        },
        infoGeneration: infoState.infoGeneration,
        pageGeneration: infoState.pageGeneration,
        unsubscribePageUrlChanged,
        unsubscribeElementsUpdated,
      };
      log.debug("status domain init completed");
    },
    // statusドメインを開始する関数
    start: async (): Promise<void> => {
      await baseDomain.start();
      const runtime = resolveRuntime();
      if (!runtime) throw new Error("Status domain runtime is not initialized");

      const pageState = runtime.context.state.page.get();
      if (pageState.isWatchPage) {
        syncVideoInfo("initial-start", {
          forceSyncByPageGeneration: true,
        });
      }
      log.debug("status domain start completed");
    },
    // statusドメインを停止する関数
    stop: async (): Promise<void> => {
      if (runtime) {
        log.debug("status domain stopping");
        runtime.unsubscribePageUrlChanged?.();
        runtime.unsubscribeElementsUpdated?.();
      }
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createStatusDomain };
