/**
 * bootstrapのブラウザランタイムテスト
 */
import { bootstrap } from "@main/bootstrap/bootstrap";
import type { DomainModule } from "@main/domain/shared/create-domain-module";
import type { DomainName } from "@main/domain/shared/domain-name";
import type { HeadlessBridgeDetails } from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

// テスト用ドメインを作成する関数
const createDomain = (name: DomainName, record: string[]): DomainModule => ({
  name,
  init: async () => {
    record.push(`${name}:init`);
  },
  start: async () => {
    record.push(`${name}:start`);
  },
  stop: async () => {
    record.push(`${name}:stop`);
  },
});

const runTest = async (): Promise<HeadlessBridgeDetails> => {
  const record: string[] = [];

  const runtime = await bootstrap({
    domainModules: [
      createDomain("page", record),
      createDomain("pip", record),
      createDomain("elements", record),
      createDomain("status", record),
    ],
  });

  await runtime.stop();

  const details: HeadlessBridgeDetails = {
    domainsSortedByBootstrapList: JSON.stringify(record.slice(0, 4)) === JSON.stringify([
      "pip:init",
      "status:init",
      "elements:init",
      "page:init",
    ]),
    domainsStartedByBootstrapList: JSON.stringify(record.slice(4, 8)) === JSON.stringify([
      "pip:start",
      "status:start",
      "elements:start",
      "page:start",
    ]),
    stopRunsInReverseOrder: JSON.stringify(record.slice(8)) === JSON.stringify([
      "page:stop",
      "elements:stop",
      "status:stop",
      "pip:stop",
    ]),
  };

  return details;
};

// エクスポート
export { runTest };
