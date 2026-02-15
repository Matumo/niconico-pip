/**
 * controllerドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// controllerドメインを作成する関数
const createControllerDomain = (): DomainModule => createDomainModule("controller", "control");

// エクスポート
export { createControllerDomain };
