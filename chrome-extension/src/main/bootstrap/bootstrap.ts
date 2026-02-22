/**
 * 起動シーケンス
 */
import { createAppContext, type CreateAppContextOptions } from "@main/bootstrap/create-app-context";
import { createAdDomain } from "@main/domain/ad";
import { createControllerDomain } from "@main/domain/controller";
import type { DomainModule, DomainPhase } from "@main/domain/create-domain-module";
import { createElementsDomain } from "@main/domain/elements";
import { createMediaSessionDomain } from "@main/domain/media-session";
import { createPageDomain } from "@main/domain/page";
import { createPipDomain } from "@main/domain/pip";
import { createStatusDomain } from "@main/domain/status";
import { createTimeDomain } from "@main/domain/time";
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

// ドメイン起動順の優先度定義
const domainPhaseOrder = {
  coreDetection: 1,
  control: 2,
  presentation: 3,
  urlWatch: 4,
} as const satisfies Record<DomainPhase, number>;

// 既定のドメイン一覧を作成する関数
const createDefaultDomainModules = (): DomainModule[] => [
  createPageDomain(),
  createElementsDomain(),
  createStatusDomain(),
  createTimeDomain(),
  createControllerDomain(),
  createMediaSessionDomain(),
  createPipDomain(),
  createAdDomain(),
];

// ドメイン一覧をフェーズ順へ整列する関数
const sortDomainModules = (domainModules: DomainModule[]): DomainModule[] =>
  [...domainModules].sort((left, right) => domainPhaseOrder[left.phase] - domainPhaseOrder[right.phase]);

// 起動処理を実行して停止関数を返す関数
const bootstrap = async (options: BootstrapOptions = {}): Promise<BootstrapRuntime> => {
  let context: AppContext;
  let stateWriters: AppStateWriters;

  // コンテキスト未注入時だけstate公開値とwriterを生成する
  if (options.context) {
    context = options.context;
    stateWriters = options.stateWriters;
  } else {
    const stateContainer = createAppStateContainer();
    context = createAppContext(stateContainer.state, options);
    stateWriters = stateContainer.writers;
  }

  // 実行順を初期化
  const safeRunner = createSafeRunner(context.loggers.safeRunner);
  const orderedDomains = sortDomainModules(options.domainModules ?? createDefaultDomainModules());

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
