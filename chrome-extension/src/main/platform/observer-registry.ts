/**
 * オブザーバーレジストリ
 */
import type { AppObserverRegistry } from "@main/types/app-context";

// MutationObserver生成関数型
type MutationObserverFactory = (callback: MutationCallback) => MutationObserver;

// 登録済みオブザーバー保持型
type RegisteredObserver = {
  observer: MutationObserver;
};

// createObserverRegistryの入力型
interface CreateObserverRegistryOptions {
  createObserver?: MutationObserverFactory;
}

// 既定のMutationObserver生成関数を作成する関数
const createDefaultObserverFactory = (): MutationObserverFactory =>
  (callback: MutationCallback): MutationObserver => new MutationObserver(callback);

// オブザーバー登録、解除を管理する関数
const createObserverRegistry = (
  options: CreateObserverRegistryOptions = {},
): AppObserverRegistry => {
  const createObserver = options.createObserver ?? createDefaultObserverFactory();
  // 登録済みオブザーバー情報
  const observers = new Map<string, RegisteredObserver>();

  // 指定キーのオブザーバーを解除する関数
  const disconnect = (key: string): boolean => {
    const existing = observers.get(key);
    if (!existing) return false;

    existing.observer.disconnect();
    observers.delete(key);
    return true;
  };

  // 指定キーでオブザーバーを登録する関数
  const observe = (params: {
    key: string;
    target: Node;
    callback: MutationCallback;
    options: MutationObserverInit;
  }): MutationObserver => {
    // 同一キーの二重登録を防ぐ
    disconnect(params.key);

    // 監視を開始して登録情報へ保持
    const observer = createObserver(params.callback);
    observer.observe(params.target, params.options);

    observers.set(params.key, { observer });
    return observer;
  };

  // 全オブザーバーを解除する関数
  const disconnectAll = (): void => {
    // 競合回避のためキーを複製してから処理
    const keys = [...observers.keys()];
    for (const key of keys) disconnect(key);
  };

  return {
    observe,
    disconnect,
    disconnectAll,
    size: () => observers.size,
  };
};

// エクスポート
export { createObserverRegistry };
export type { CreateObserverRegistryOptions };
