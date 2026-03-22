/**
 * controllerドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/shared/create-domain-module";

// controllerドメインを作成する関数
const createControllerDomain = (): DomainModule => createDomainModule("controller");

// エクスポート
export { createControllerDomain };
