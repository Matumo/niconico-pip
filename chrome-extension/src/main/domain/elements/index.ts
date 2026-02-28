/**
 * elementsドメイン
 */
import {
  createVideoElementObserver,
  type VideoElementObserver,
  type VideoElementObserverTrigger,
} from "@main/adapter/dom/video-element-observer";
import type { AppEventMap, ElementsSnapshot } from "@main/config/event";
import { selectorDefinitions, type SelectorKey } from "@main/config/selector";
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { AppContext, AppStateWriters, Unsubscribe } from "@main/types/app-context";

// 要素同期の発火要因型
type ElementsSyncTrigger = VideoElementObserverTrigger | "page-url-changed";

// elementsドメイン実行時に利用するランタイム依存型
interface ElementsDomainRuntime {
  context: AppContext;
  stateWriters: AppStateWriters;
  videoElementObserver: VideoElementObserver;
  snapshot: ElementsSnapshot;
  elementsGeneration: number;
  activePlayerContainer: HTMLDivElement | null;
  unsubscribePageUrlChanged: Unsubscribe | null;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  dispatchEvent?: (event: Event) => boolean;
};

const selectorKeys = Object.keys(selectorDefinitions) as SelectorKey[];
const log = getLogger(appLoggerNames.domain);

// スナップショットへ要素値を設定する関数
const setSnapshotValue = <K extends SelectorKey>(
  snapshot: ElementsSnapshot,
  key: K,
  value: ElementsSnapshot[K],
): void => {
  snapshot[key] = value;
};

// globalThisをEventTargetとして扱えるか判定する関数
const resolveEventTarget = (): EventTarget | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  if (typeof browserGlobal.dispatchEvent !== "function") return null;
  return browserGlobal as unknown as EventTarget;
};

// 空の要素スナップショットを作成する関数
const createEmptySnapshot = (): ElementsSnapshot => {
  const snapshot = {} as ElementsSnapshot;
  for (const key of selectorKeys) {
    setSnapshotValue(snapshot, key, null);
  }
  return snapshot;
};

// 要素リゾルバーから最新スナップショットを取得する関数
const resolveSnapshot = (context: AppContext): ElementsSnapshot => {
  const snapshot = createEmptySnapshot();

  // 全キャッシュを破棄
  context.elementResolver.invalidateAll();

  // selector定義順で全キーを再解決
  for (const key of selectorKeys) {
    setSnapshotValue(snapshot, key, context.elementResolver.resolve(key));
  }

  return snapshot;
};

// 2つのスナップショット差分から変更キーの一覧を返す関数
const resolveChangedKeys = (before: ElementsSnapshot, after: ElementsSnapshot): SelectorKey[] =>
  selectorKeys.filter((key) => before[key] !== after[key]);

// ElementsUpdatedのpayloadを作成する関数
const createElementsUpdatedPayload = (params: {
  pageGeneration: number;
  elementsGeneration: number;
  changedKeys: readonly SelectorKey[];
  snapshot: ElementsSnapshot;
}): AppEventMap["ElementsUpdated"] => {
  const snapshot = Object.freeze({ ...params.snapshot });
  const changedKeys = Object.freeze([...params.changedKeys]);
  return Object.freeze({
    pageGeneration: params.pageGeneration,
    elementsGeneration: params.elementsGeneration,
    changedKeys,
    snapshot,
  });
};

// elementsドメインを作成する関数
const createElementsDomain = (): DomainModule => {
  const baseDomain = createDomainModule("elements", "coreDetection");
  // 実行時の情報
  let runtime: ElementsDomainRuntime | null = null;

  // elementsドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): ElementsDomainRuntime | null => {
    if (!runtime) log.warn("elements runtime is not initialized");
    return runtime;
  };

  // player監視対象を最新のスナップショットに合わせて切り替える関数
  const syncObserverTarget = (runtime: ElementsDomainRuntime, snapshot: ElementsSnapshot): void => {
    const nextPlayerContainer = snapshot.playerContainer;

    // player未検出時はdiscover監視に戻す
    if (!nextPlayerContainer) {
      if (runtime.activePlayerContainer !== null) {
        runtime.videoElementObserver.switchToDiscover();
        runtime.activePlayerContainer = null;
        log.debug("elements observer switched to discover-player");
      }
      return;
    }

    // 監視中のplayerContainerと同一なら、何もせず終了する
    if (runtime.activePlayerContainer === nextPlayerContainer) return;

    // 新しいplayerContainerを見つけたら、discover監視からplayer監視へ切り替える
    runtime.videoElementObserver.switchToPlayer(nextPlayerContainer);
    runtime.activePlayerContainer = nextPlayerContainer;
    log.debug("elements observer switched to watch-player");
  };

  // スナップショット差分を確定してstate更新とイベント通知を行う関数
  const commitSnapshot = (
    runtime: ElementsDomainRuntime,
    nextSnapshot: ElementsSnapshot,
    trigger: ElementsSyncTrigger,
  ): void => {
    // 前回スナップショットとの差分キーを求める
    const changedKeys = resolveChangedKeys(runtime.snapshot, nextSnapshot);
    if (changedKeys.length === 0) {
      // 差分がなければ世代更新もイベント通知も行わない
      log.debug(`elements unchanged (trigger=${trigger})`);
      return;
    }

    runtime.snapshot = nextSnapshot;
    runtime.elementsGeneration += 1;

    // state更新
    runtime.stateWriters.elements.patch({
      lastResolvedGeneration: runtime.elementsGeneration,
      lastResolvedAt: Date.now(),
    });

    // イベントターゲット取得
    const eventTarget = resolveEventTarget();
    if (!eventTarget) {
      log.warn("ElementsUpdated emit skipped: global event target is unavailable");
      return;
    }
    // イベントデータ準備
    const pageGeneration = runtime.context.state.page.get().generation;
    const payload = createElementsUpdatedPayload({
      pageGeneration,
      elementsGeneration: runtime.elementsGeneration,
      changedKeys,
      snapshot: runtime.snapshot,
    });
    // イベント発火
    runtime.context.eventRegistry.emit({
      target: eventTarget,
      eventKey: "ElementsUpdated",
      payload,
    });

    log.info(`elements updated: changedKeys=${changedKeys.join(",")} (trigger=${trigger})`);
    log.debug("elements updated payload:", payload);
  };

  // 要素差分を判定してstate更新とイベント通知を行う関数
  const syncElements = (trigger: ElementsSyncTrigger): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // 全要素を再解決する
    const nextSnapshot = resolveSnapshot(runtime.context);
    // 最新スナップショットに合わせてdiscover/player監視を切り替える
    syncObserverTarget(runtime, nextSnapshot);
    commitSnapshot(runtime, nextSnapshot, trigger);
  };

  // PageUrlChanged通知を受けて監視ライフサイクルと要素同期を切り替える関数
  const handlePageUrlChanged = (payload: AppEventMap["PageUrlChanged"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // NOTE: pageドメインが判定したisWatchPageをそのまま使い、監視開始/停止を分岐する。
    // elements側で再判定しないことで、イベント契約を単一の真実源として扱う。
    if (!payload.isWatchPage) {
      runtime.videoElementObserver.stop();
      runtime.activePlayerContainer = null;

      // NOTE: 非watchページ遷移時は空スナップショットを1回だけ通知し、
      // 下流ドメインの要素参照リセット合図として扱う。
      commitSnapshot(runtime, createEmptySnapshot(), "page-url-changed");
      return;
    }

    // NOTE: watchページ遷移時は分岐を増やさず start + discover + sync を常に実行する。
    // watch復帰直後はinitial-startと近接して再評価が重なる可能性があるが、
    // 差分なし通知は抑止されるため挙動の整合は維持される。
    runtime.videoElementObserver.start();
    runtime.videoElementObserver.switchToDiscover();
    runtime.activePlayerContainer = null;
    syncElements("page-url-changed");
  };

  return {
    ...baseDomain,
    // elementsドメインを初期化する関数
    init: async (nextContext, nextStateWriters): Promise<void> => {
      await baseDomain.init(nextContext, nextStateWriters);

      const videoElementObserver = createVideoElementObserver({
        observerRegistry: nextContext.observerRegistry,
        onDiscoverCheckRequested: syncElements,
        onPlayerCheckRequested: syncElements,
      });

      let unsubscribePageUrlChanged: Unsubscribe | null = null;
      const eventTarget = resolveEventTarget();
      if (eventTarget) {
        unsubscribePageUrlChanged = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:elements:page-url-changed",
          eventKey: "PageUrlChanged",
          listener: (payload) => {
            handlePageUrlChanged(payload);
          },
        });
      } else {
        log.warn("PageUrlChanged listen skipped: global event target is unavailable");
      }

      const snapshot = createEmptySnapshot();
      const elementsGeneration = nextContext.state.elements.get().lastResolvedGeneration;

      runtime = {
        context: nextContext,
        stateWriters: nextStateWriters,
        videoElementObserver,
        snapshot,
        elementsGeneration,
        activePlayerContainer: null,
        unsubscribePageUrlChanged,
      };
      log.debug("elements domain init completed");
    },
    // elementsドメインを開始する関数
    start: async (): Promise<void> => {
      await baseDomain.start();
      const runtime = resolveRuntime();
      if (!runtime) throw new Error("Elements domain runtime is not initialized");

      runtime.videoElementObserver.start();
      log.debug("elements domain start completed");
    },
    // elementsドメインを停止する関数
    stop: async (): Promise<void> => {
      if (runtime) {
        log.debug("elements domain stopping");
        runtime.videoElementObserver.stop();
        runtime.unsubscribePageUrlChanged?.();
      }
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createElementsDomain };
