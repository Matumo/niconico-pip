/**
 * media-sessionドメイン
 */
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";

// media-sessionドメインを作成する関数
const createMediaSessionDomain = (): DomainModule => createDomainModule("media-session", "control");

// エクスポート
export { createMediaSessionDomain };
