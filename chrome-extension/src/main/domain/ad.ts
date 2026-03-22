/**
 * adドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/shared/create-domain-module";

// adドメインを作成する関数
const createAdDomain = (): DomainModule => createDomainModule("ad");

// エクスポート
export { createAdDomain };
