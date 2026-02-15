/**
 * 要素リゾルバー
 */
import type { SelectorDefinitions, SelectorElementMap, SelectorKey } from "@main/config/selector";
import { selectorDefinitions } from "@main/config/selector";
import type { AppElementResolver } from "@main/types/app-context";
import type { Logger } from "@matumo/ts-simple-logger";

// querySelectorを持つルート型
interface QueryRoot {
  querySelector(selectors: string): Element | null;
}

// createElementResolverの入力型
interface CreateElementResolverOptions {
  root: QueryRoot;
  logger: Logger;
  getPageGeneration: () => number;
  definitions?: SelectorDefinitions;
}

// キャッシュエントリー型
type CacheEntry = {
  element: Element;
  generation: number;
};

// セレクタ定義に従って要素を解決する関数
const createElementResolver = (options: CreateElementResolverOptions): AppElementResolver => {
  const definitions = options.definitions ?? selectorDefinitions;
  const log = options.logger;
  const cache = new Map<SelectorKey, CacheEntry>();

  // キャッシュエントリーの有効性を判定する関数
  const isEntryValid = <K extends SelectorKey>(key: K, entry: CacheEntry): entry is {
    element: SelectorElementMap[K];
    generation: number;
  } => {
    const currentGeneration = options.getPageGeneration();
    const definition = definitions[key];

    return (
      // 取得時と現在の世代が同じ
      entry.generation === currentGeneration &&
      // DOMツリーに接続された要素のみ許可
      entry.element.isConnected &&
      // セレクタキーに対応する型ガードを通過した要素のみ許可
      definition.guard(entry.element)
    );
  };

  // primaryとfallbackを順に評価して要素を取得する関数
  const findElement = <K extends SelectorKey>(key: K): SelectorElementMap[K] | null => {
    // primaryを最優先し、見つからない場合のみfallbackを評価する
    const definition = definitions[key];
    const candidates = [definition.primary, ...definition.fallbacks];
    for (const selector of candidates) {
      const candidate = options.root.querySelector(selector);
      if (!candidate) continue; // 見つからなければ次のselectorへ

      // guardを通過した要素だけを返す
      if (definition.guard(candidate)) return candidate;

      // selectorは一致したが期待型ではない場合のみ警告する
      log.warn(`Selector guard rejected element for key=${key}`, { selector });
    }

    return null;
  };

  // キャッシュのみを参照して要素を返す関数
  const peek = <K extends SelectorKey>(key: K): SelectorElementMap[K] | null => {
    const entry = cache.get(key);
    if (!entry) return null; // キャッシュ未登録

    // 無効キャッシュは即削除して以後の誤利用を防ぐ
    if (!isEntryValid(key, entry)) {
      cache.delete(key);
      return null;
    }

    // 有効なキャッシュ値を返す
    return entry.element;
  };

  // キャッシュを考慮して要素を解決する関数
  const resolve = <K extends SelectorKey>(key: K): SelectorElementMap[K] | null => {
    // キャッシュ参照
    const cached = peek(key);
    if (cached) return cached;

    // キャッシュミス時のみprimary/fallbackで探索
    const resolved = findElement(key);
    // 未解決時は古いキャッシュを残さない
    if (!resolved) {
      cache.delete(key);
      return null;
    }

    // 解決した要素を現世代でキャッシュ
    cache.set(key, {
      element: resolved,
      generation: options.getPageGeneration(),
    });

    return resolved;
  };

  // 指定キーのキャッシュを無効化する関数
  const invalidate = (key: SelectorKey): void => {
    cache.delete(key);
  };

  // 全キャッシュを無効化する関数
  const invalidateAll = (): void => {
    cache.clear();
  };

  return {
    resolve,
    peek,
    invalidate,
    invalidateAll,
  };
};

// エクスポート
export { createElementResolver };
export type { QueryRoot, CreateElementResolverOptions };
