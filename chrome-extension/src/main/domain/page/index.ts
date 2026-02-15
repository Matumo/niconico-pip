/**
 * pageドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// pageドメインを作成する関数
const createPageDomain = (): DomainModule => createDomainModule("page", "coreDetection");

// エクスポート
export { createPageDomain };
