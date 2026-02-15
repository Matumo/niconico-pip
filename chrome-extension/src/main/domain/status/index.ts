/**
 * statusドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// statusドメインを作成する関数
const createStatusDomain = (): DomainModule => createDomainModule("status", "coreDetection");

// エクスポート
export { createStatusDomain };
