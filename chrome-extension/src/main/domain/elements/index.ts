/**
 * elementsドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// elementsドメインを作成する関数
const createElementsDomain = (): DomainModule => createDomainModule("elements", "coreDetection");

// エクスポート
export { createElementsDomain };
