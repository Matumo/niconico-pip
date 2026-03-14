/**
 * debug dumpレジストリ
 */
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import { installDebugDumpTrigger } from "./debug-dump-trigger";
import {
  createAppContextDebugDumpSource,
  createElementsDomainDebugDumpSource,
  createPageDomainDebugDumpSource,
  createPipDomainDebugDumpSource,
  createStatusDomainDebugDumpSource,
  debugDumpSourceNames,
  type DebugDumpSourceName,
} from "./debug-dump-sources";
import type { AppContext } from "@main/types/app-context";
import type {
  DebugDumpObject,
  DebugDumpRegistry,
  DebugDumpSource,
  DebugDumpValue,
} from "./debug-dump-types";

type DebugDumpErrorValue = Error | string | number | boolean | bigint | null
  | undefined | object | symbol | ((...args: never[]) => unknown);

const log = getLogger(appLoggerNames.debug);

// debug dump向けに例外を文字列化する関数
const stringifyDebugDumpError = (error: DebugDumpErrorValue): string => {
  if (error instanceof Error) return error.message;
  if (error === null) return "null";
  switch (typeof error) {
    case "string":
      return error;
    case "number":
    case "boolean":
    case "bigint":
      return String(error);
    case "undefined":
      return "undefined";
    case "object":
      try {
        return JSON.stringify(error);
      } catch {
        return Object.prototype.toString.call(error);
      }
    case "symbol":
      return error.toString();
    case "function":
      return error.name ? `[Function ${error.name}]` : "[Function anonymous]";
  }
};

// 例外をdebug dump用のPOJOへ変換する関数
const createDebugDumpErrorSnapshot = (error: unknown): DebugDumpObject => ({
  __debugDumpError: true,
  message: stringifyDebugDumpError(error as DebugDumpErrorValue),
});

// debug dumpレジストリを作成する関数
const createDebugDumpRegistry = (context: AppContext): DebugDumpRegistry => {
  const sources = new Map<DebugDumpSourceName, DebugDumpSource>();
  let uninstallTrigger: (() => void) | null = null;

  // debugModeで有効化された、自身に紐づくregistry経由の呼び出しだけを許可する
  const assertRegistryAvailable = (action: string): void => {
    if (context.config.debugMode !== true) {
      throw new Error(`debug dump ${action} requires config.debugMode === true`);
    }
    if (context.debugDumpRegistry !== registry) {
      throw new Error(`debug dump ${action} requires context.debugDumpRegistry`);
    }
  };

  const registerSource = (name: DebugDumpSourceName, source: DebugDumpSource): void => {
    assertRegistryAvailable(`register source "${name}"`);
    sources.set(name, source);
  };

  const unregisterSource = (name: DebugDumpSourceName): void => {
    assertRegistryAvailable(`unregister source "${name}"`);
    sources.delete(name);
  };

  const collect = (): DebugDumpObject => {
    const snapshots: DebugDumpObject = {};

    // 1sourceの失敗で全dumpを落とさず、失敗内容だけを該当sourceに載せる
    for (const [name, source] of sources) {
      let snapshot: DebugDumpValue;
      try {
        snapshot = source();
      } catch (error: unknown) {
        log.warn(`debug dump source failed: ${name}`, error);
        snapshot = createDebugDumpErrorSnapshot(error);
      }

      snapshots[name] = snapshot ?? null;
    }

    return snapshots;
  };

  const registry: DebugDumpRegistry = {
    registerAppContext: (): void => {
      registerSource(debugDumpSourceNames.appContext, createAppContextDebugDumpSource(context));
    },
    unregisterAppContext: (): void => {
      unregisterSource(debugDumpSourceNames.appContext);
    },
    registerPageDomain: (options): void => {
      registerSource(debugDumpSourceNames.pageDomain, createPageDomainDebugDumpSource(context, options));
    },
    unregisterPageDomain: (): void => {
      unregisterSource(debugDumpSourceNames.pageDomain);
    },
    registerElementsDomain: (options): void => {
      registerSource(debugDumpSourceNames.elementsDomain, createElementsDomainDebugDumpSource(context, options));
    },
    unregisterElementsDomain: (): void => {
      unregisterSource(debugDumpSourceNames.elementsDomain);
    },
    registerStatusDomain: (options): void => {
      registerSource(debugDumpSourceNames.statusDomain, createStatusDomainDebugDumpSource(context, options));
    },
    unregisterStatusDomain: (): void => {
      unregisterSource(debugDumpSourceNames.statusDomain);
    },
    registerPipDomain: (options): void => {
      registerSource(debugDumpSourceNames.pipDomain, createPipDomainDebugDumpSource(context, options));
    },
    unregisterPipDomain: (): void => {
      unregisterSource(debugDumpSourceNames.pipDomain);
    },
    installTrigger: (): void => {
      assertRegistryAvailable("install trigger");
      // triggerの再登録では既存listenerを先に外して、重複登録を避ける
      uninstallTrigger?.();
      uninstallTrigger = installDebugDumpTrigger({
        prefixId: context.config.prefixId,
        collectSources: collect,
      });
    },
    uninstallTrigger: (): void => {
      assertRegistryAvailable("uninstall trigger");
      uninstallTrigger?.();
      uninstallTrigger = null;
    },
    clearSources: (): void => {
      assertRegistryAvailable("clear sources");
      sources.clear();
    },
    size: (): number => sources.size,
    collect,
  };

  return registry;
};

// エクスポート
export { createDebugDumpRegistry };
