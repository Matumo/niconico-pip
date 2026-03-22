/**
 * 起動シーケンス
 */
import { createAppContext, type CreateAppContextOptions } from "@main/bootstrap/create-app-context";
import { createAppConfig } from "@main/config/config";
import { createAdDomain } from "@main/domain/ad";
import { createControllerDomain } from "@main/domain/controller";
import type { DomainModule } from "@main/domain/shared/create-domain-module";
import { domainNameOrderList, type DomainName } from "@main/domain/shared/domain-name";
import { createElementsDomain } from "@main/domain/elements";
import { createMediaSessionDomain } from "@main/domain/media-session";
import { createPageDomain } from "@main/domain/page";
import { createPipDomain } from "@main/domain/pip";
import { createStatusDomain } from "@main/domain/status";
import { createTimeDomain } from "@main/domain/time";
import { initializeLoggers } from "@main/platform/logger";
import { createSafeRunner } from "@main/platform/safe-runner";
import { createAppStateContainer } from "@main/platform/state";
import type { AppContext, AppStateWriters } from "@main/types/app-context";

// 起動後に返すランタイム型
interface BootstrapRuntime {
  context: AppContext;
  stop: () => Promise<void>;
}

// bootstrapの入力型
type BootstrapOptions =
  | ({
    context: AppContext;
    stateWriters: AppStateWriters;
    domainModules?: DomainModule[];
  })
  | (CreateAppContextOptions & {
    context?: never;
    stateWriters?: never;
    domainModules?: DomainModule[];
  });

const domainModuleFactories = {
  "elements": createElementsDomain,
  "status": createStatusDomain,
  "time": createTimeDomain,
  "controller": createControllerDomain,
  "media-session": createMediaSessionDomain,
  "pip": createPipDomain,
  "ad": createAdDomain,
  "page": createPageDomain,
} as const satisfies Record<DomainName, () => DomainModule>;

// 起動順リストから優先度レコードを構築する
const defaultDomainOrderRecord = domainNameOrderList.reduce<Record<DomainName, number>>(
  (record, domainName, index) => {
    record[domainName] = index;
    return record;
  },
  {} as Record<DomainName, number>,
);

// ドメイン名から既定起動順を取得する関数
const resolveDomainOrder = (domainName: DomainName): number => defaultDomainOrderRecord[domainName];

// 既定のドメイン一覧を作成する関数
const createDefaultDomainModules = (): DomainModule[] =>
  domainNameOrderList.map((domainName) => domainModuleFactories[domainName]());

// ドメイン一覧を起動順リストへ整列する関数
const sortDomainModules = (domainModules: DomainModule[]): DomainModule[] =>
  [...domainModules].sort((left, right) => resolveDomainOrder(left.name) - resolveDomainOrder(right.name));

// 起動処理を実行して停止関数を返す関数
const bootstrap = async (options: BootstrapOptions = {}): Promise<BootstrapRuntime> => {
  let context: AppContext;
  let stateWriters: AppStateWriters;

  // config構築
  const config = options.context?.config ?? createAppConfig();
  // ロガー初期化
  initializeLoggers({
    appName: config.appName,
    useDebugLog: config.shouldUseDebugLog,
  });

  // コンテキスト未注入時だけstate公開値とwriterを生成する
  if (options.context) {
    context = options.context;
    stateWriters = options.stateWriters;
  } else {
    const stateContainer = createAppStateContainer();
    context = createAppContext(
      stateContainer.state,
      {
        config,
      },
      options,
    );
    stateWriters = stateContainer.writers;
  }

  // 実行順を初期化
  const safeRunner = createSafeRunner();
  const orderedDomains = sortDomainModules(options.domainModules ?? createDefaultDomainModules());

  // debug dumpの登録
  if (context.debugDumpRegistry) {
    context.debugDumpRegistry.registerAppContext();
    context.debugDumpRegistry.installTrigger();
  }

  // initを順方向に実行
  for (const domain of orderedDomains) {
    await safeRunner.runAsync(`domain:${domain.name}:init`, async () => {
      await domain.init(context, stateWriters);
      return true;
    });
  }

  // startを順方向に実行
  for (const domain of orderedDomains) {
    await safeRunner.runAsync(`domain:${domain.name}:start`, async () => {
      await domain.start();
      return true;
    });
  }

  // stopを逆順で実行して共通資源を解放する関数
  const stop = async (): Promise<void> => {
    for (const domain of [...orderedDomains].reverse()) {
      await safeRunner.runAsync(`domain:${domain.name}:stop`, async () => {
        await domain.stop();
        return true;
      });
    }

    // debug dumpの解除
    if (context.debugDumpRegistry) {
      context.debugDumpRegistry.uninstallTrigger();
      context.debugDumpRegistry.clearSources();
    }

    // 後処理
    context.observerRegistry.disconnectAll();
    context.eventRegistry.clear();
    context.elementResolver.invalidateAll();
    context.httpClient.clearInFlight();
    context.httpClient.clearCache();
  };

  // コンテキストとstop関数を返す
  return {
    context,
    stop,
  };
};

// エクスポート
export { bootstrap };
export type { BootstrapRuntime, BootstrapOptions };
