/**
 * 動画要素監視アダプター
 */
import { appLoggerNames } from "@main/platform/logger";
import { discoverPlayerTargetSelectors } from "@main/config/selector";
import type { AppObserverRegistry } from "@main/types/app-context";
import { getLogger } from "@matumo/ts-simple-logger";

// 動画要素再評価の発火要因型
type VideoElementObserverTrigger = "initial-start" | "discover-mutation" | "player-mutation";

// 動画要素監視の入力型
interface CreateVideoElementObserverOptions {
  observerRegistry: AppObserverRegistry;
  onDiscoverCheckRequested: (trigger: VideoElementObserverTrigger) => void;
  onPlayerCheckRequested: (trigger: VideoElementObserverTrigger) => void;
}

// 動画要素監視インターフェース型
interface VideoElementObserver {
  start(): void;
  switchToDiscover(): void;
  switchToPlayer(target: Node): void;
  stop(): void;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  document?: Document;
};

// discover監視対象を解決するための最小Document型
type DocumentLike = Node & {
  querySelector?: (selectors: string) => Element | null;
  body?: Node | null;
};

// discover監視対象の解決結果型
interface ResolvedDiscoverTarget {
  target: Node;
  selector: string | null;
}

const discoverObserverKey = "elements:discover-player-observer";
const playerObserverKey = "elements:watch-player-observer";
const log = getLogger(appLoggerNames.domain);

// Nodeインターフェースの最小判定関数
const isNodeLike = (value: unknown): value is Node =>
  typeof value === "object" && value !== null &&
  typeof (value as { nodeType?: unknown }).nodeType === "number";

// シークバーの大量発生するMutationRecordを検出する関数
const isSeekBarMutation = (mutation: MutationRecord): boolean =>
  // 再生バーが進むときに発生する大量の要素変更に関する対策
  // attributeNameがstyleかつtypeがattributesのとき
  mutation.attributeName === "style" && mutation.type === "attributes";

const isSeekBarCursorMutation = (mutation: MutationRecord): boolean =>
  // 再生バーにカーソルを合わせたときに発生する大量の要素変更に関する対策
  // addedNodesが1つ、removeNodesが1つ、targetがspan要素のとき
  mutation.addedNodes?.length === 1 && mutation.removedNodes?.length === 1 &&
  mutation.target instanceof HTMLElement && mutation.target.tagName.toLowerCase() === "span";

// シークバー関連のMutationRecordをスキップするか判定する関数
const skipMutation = (mutations: MutationRecord[]): boolean => {
  // 全てのMutationがスキップ対象であればtrueを返す
  let skip = true;
  for (const mutation of mutations) {
    skip = isSeekBarMutation(mutation) || isSeekBarCursorMutation(mutation);
    if (!skip) break;
  }
  return skip;
};

// discover監視対象を可能な限り絞って解決する関数
const resolveDiscoverTarget = (rootNode: Node): ResolvedDiscoverTarget => {
  const documentLike = rootNode as DocumentLike;
  if (typeof documentLike.querySelector !== "function") {
    return {
      target: rootNode,
      selector: null,
    };
  }
  for (const selector of discoverPlayerTargetSelectors) {
    const target = documentLike.querySelector(selector);
    if (isNodeLike(target)) {
      return { target, selector };
    }
  }
  return {
    target: rootNode,
    selector: null,
  };
};

// 動画要素監視を作成する関数
const createVideoElementObserver = (options: CreateVideoElementObserverOptions): VideoElementObserver => {
  // 監視の二重開始を防ぐフラグ
  let started = false;

  // discover監視へ切り替える関数
  const switchToDiscover = (): void => {
    if (!started) return;

    // playerの監視を解除
    options.observerRegistry.disconnect(playerObserverKey);

    const browserGlobal = globalThis as BrowserGlobal;
    const documentNode = browserGlobal.document;
    if (!isNodeLike(documentNode)) {
      log.info("video element observer discover skipped: document is unavailable");
      return;
    }
    const discoverTarget = resolveDiscoverTarget(documentNode);
    log.debug("video element observer discover target resolved:", discoverTarget);

    // discoverの監視を開始
    options.observerRegistry.observe({
      key: discoverObserverKey,
      target: discoverTarget.target,
      callback: (mutations) => {
        const skip = skipMutation(mutations); // スキップ対象であるかどうか判定する
        log.debug("video element observer discover mutation:", {skip, mutations});
        if (skip) return;
        options.onDiscoverCheckRequested("discover-mutation");
      },
      options: {
        // WARNING: 低速読み込み時にdocument直下だけ先に読み込みが完了して
        // playerが後から挿入されるケースも考慮してsubtreeはtrueを維持する
        subtree: true,
        childList: true,
        attributes: false,
      },
    });
    log.info("video element observer switched to discover");
  };

  // player監視へ切り替える関数
  const switchToPlayer = (target: Node): void => {
    if (!started) return;

    // discoverの監視を解除
    options.observerRegistry.disconnect(discoverObserverKey);
    options.observerRegistry.observe({
      key: playerObserverKey,
      target,
      callback: (mutations) => {
        const skip = skipMutation(mutations); // スキップ対象であるかどうか判定する
        log.debug("video element observer player mutation:", {skip, mutations});
        if (skip) return;
        options.onPlayerCheckRequested("player-mutation");
      },
      options: {
        subtree: false,
        childList: true,
        attributes: false,
      },
    });
    log.info("video element observer switched to player");
  };

  // 動画要素監視を開始する関数
  const start = (): void => {
    if (started) return;
    started = true;
    log.info("video element observer started");

    // 起動時は必ずdiscoverから開始し、初回同期を1回だけ要求する
    switchToDiscover();
    options.onDiscoverCheckRequested("initial-start");
  };

  // 動画要素監視を停止する関数
  const stop = (): void => {
    if (!started) return;
    started = false;

    options.observerRegistry.disconnect(discoverObserverKey);
    options.observerRegistry.disconnect(playerObserverKey);
    log.info("video element observer stopped");
  };

  return {
    start,
    switchToDiscover,
    switchToPlayer,
    stop,
  };
};

// エクスポート
export { createVideoElementObserver };
export type { CreateVideoElementObserverOptions, VideoElementObserver, VideoElementObserverTrigger };
