/**
 * pageドメイン
 */
import {
  createUrlChangeObserver,
  type UrlChangeObserver,
  type UrlCheckTrigger,
} from "@main/adapter/dom/url-change-observer";
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";
import type { AppContext, AppStateWriters } from "@main/types/app-context";

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  location?: Location;
  dispatchEvent?: (event: Event) => boolean;
};

// 現在URLを取得する関数
const resolveCurrentUrl = (): string | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  const location = browserGlobal.location;
  if (!location || typeof location.href !== "string") return null;
  return location.href;
};

// globalThisをEventTargetとして扱えるか判定する関数
const resolveEventTarget = (): EventTarget | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  if (typeof browserGlobal.dispatchEvent !== "function") return null;
  return browserGlobal as unknown as EventTarget;
};

// pageドメイン実行時に利用するランタイム依存型
interface PageDomainRuntime {
  context: AppContext;
  stateWriters: AppStateWriters;
  urlChangeObserver: UrlChangeObserver;
  lastKnownUrl: string;
}

// pageドメインを作成する関数
const createPageDomain = (): DomainModule => {
  const baseDomain = createDomainModule("page", "urlWatch");
  // 実行時の情報
  let runtime: PageDomainRuntime | null = null;

  // pageドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): PageDomainRuntime => {
    // TODO: 遅延トリガー到達時の挙動を整理し、未初期化時は例外以外の回復動作へ置き換える
    if (!runtime) throw new Error("Page domain runtime is not initialized");
    return runtime;
  };

  // 現在URLをstateへ反映し、必要時にイベントを発火する関数
  const syncPageUrl = (trigger: UrlCheckTrigger): void => {
    const runtime = resolveRuntime();
    const log = runtime.context.loggers.domain;
    const currentUrl = resolveCurrentUrl();

    // 非ブラウザ環境などでlocationが使えない場合は同期をスキップする
    if (currentUrl === null) {
      log.warn(`page url sync skipped: location.href is unavailable (trigger=${trigger})`);
      return;
    }

    // 同一URLなら更新/イベント発火を抑止する
    if (currentUrl === runtime.lastKnownUrl) {
      log.debug(`page url unchanged (trigger=${trigger})`);
      return;
    }

    // ログ出力
    log.info(`page url changed: ${currentUrl} (trigger=${trigger})`);

    // 新しい情報を生成
    const currentState = runtime.context.state.page.get();
    const nextGeneration = currentState.generation + 1;
    const isWatchPage = runtime.context.config.watchPageUrlPattern.test(currentUrl);

    // 次回比較用に最新URLを保持する
    runtime.lastKnownUrl = currentUrl;

    // URL変化に合わせてpageスライスを更新する
    runtime.stateWriters.page.patch({
      url: currentUrl,
      isWatchPage,
      generation: nextGeneration,
    });
    log.debug(`page state patched: generation=${nextGeneration}, isWatchPage=${isWatchPage}`);

    // 他ドメイン向けにURL変更イベントを通知する
    const eventTarget = resolveEventTarget();
    if (eventTarget) {
      runtime.context.eventRegistry.emit({
        target: eventTarget,
        eventKey: "PageUrlChanged",
        payload: {
          url: currentUrl,
          generation: nextGeneration,
        },
      });
    } else {
      log.warn("PageUrlChanged emit skipped: global event target is unavailable");
    }
  };

  return {
    ...baseDomain,
    // pageドメインを初期化する関数
    init: async (nextContext, nextStateWriters): Promise<void> => {
      await baseDomain.init(nextContext, nextStateWriters);
      const log = nextContext.loggers.domain;

      // 監視オブジェクトはinitで構築し、startで開始する
      const urlChangeObserver = createUrlChangeObserver({
        observerRegistry: nextContext.observerRegistry,
        onUrlCheckRequested: syncPageUrl,
      });
      // 現在のコンテキストに設定されているURLを取得
      const lastKnownUrl = nextContext.state.page.get().url;

      runtime = {
        context: nextContext,
        stateWriters: nextStateWriters,
        urlChangeObserver,
        lastKnownUrl,
      };
      log.debug("page domain init completed");
    },
    // pageドメインを開始する関数
    start: async (): Promise<void> => {
      await baseDomain.start();
      const runtime = resolveRuntime();
      const log = runtime.context.loggers.domain;
      runtime.urlChangeObserver.start();
      log.debug("page domain start completed");
    },
    // pageドメインを停止する関数
    stop: async (): Promise<void> => {
      if (runtime) {
        const log = runtime.context.loggers.domain;
        log.debug("page domain stopping");
        // URL変更監視を停止
        runtime.urlChangeObserver.stop();
      }
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createPageDomain };
