/**
 * pipドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// pipドメインを作成する関数
const createPipDomain = (): DomainModule => createDomainModule("pip", "control");

// エクスポート
export { createPipDomain };
