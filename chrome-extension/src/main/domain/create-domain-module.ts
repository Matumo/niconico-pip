/**
 * ドメインモジュール共通定義
 */
import type { Lifecycle } from "@main/types/lifecycle";
import type { AppContext, AppStateWriters } from "@main/types/app-context";

// ドメインフェーズ型
type DomainPhase = "coreDetection" | "control" | "presentation" | "urlWatch";

// ドメインモジュール型
interface DomainModule extends Lifecycle {
  readonly name: string;
  readonly phase: DomainPhase;
}

// ドメインモジュールの骨格を作成する関数
const createDomainModule = (name: string, phase: DomainPhase): DomainModule => {
  let initialized = false;

  return {
    name,
    phase,
    // ドメインを初期化する関数
    init: async (context: AppContext, _: AppStateWriters): Promise<void> => {
      const log = context.loggers.domain;
      log.debug(`Domain init: ${name}`);
      initialized = true;
    },
    // ドメインを開始する関数
    start: async (): Promise<void> => {
      if (!initialized) {
        throw new Error(`Domain ${name} must be initialized before start`);
      }
    },
    // ドメインを停止する関数
    stop: async (): Promise<void> => {
      initialized = false;
    },
  };
};

// エクスポート
export { createDomainModule };
export type { DomainPhase, DomainModule };
