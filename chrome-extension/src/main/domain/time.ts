/**
 * timeドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/shared/create-domain-module";

// timeドメインを作成する関数
const createTimeDomain = (): DomainModule => createDomainModule("time", "coreDetection");

// エクスポート
export { createTimeDomain };
