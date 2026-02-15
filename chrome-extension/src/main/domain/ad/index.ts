/**
 * adドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// adドメインを作成する関数
const createAdDomain = (): DomainModule => createDomainModule("ad", "presentation");

// エクスポート
export { createAdDomain };
