/**
 * イベントレジストリ
 */
import type { AppEventKey, AppEventMap, AppEventNameMap } from "@main/config/event";
import type { AppEventRegistry, Unsubscribe } from "@main/types/app-context";

// 登録済みイベントの保持型
type RegisteredEvent = {
  target: EventTarget;
  eventName: string;
  listener: EventListener;
  options?: AddEventListenerOptions;
};

// イベントの登録、発火、解除を管理する関数
const createEventRegistry = (eventNameMap: AppEventNameMap): AppEventRegistry => {
  // 登録済みイベント情報
  const registeredEvents = new Map<string, RegisteredEvent>();

  // 指定キーのイベント登録を解除する関数
  const off = (key: string): boolean => {
    const existing = registeredEvents.get(key);
    if (!existing) return false;
    existing.target.removeEventListener(existing.eventName, existing.listener, existing.options);
    registeredEvents.delete(key);
    return true;
  };

  // 指定キーでイベント登録する関数
  const on = <K extends AppEventKey>(params: {
    target: EventTarget;
    key: string;
    eventKey: K;
    listener: (payload: AppEventMap[K]) => void;
    options?: AddEventListenerOptions;
  }): Unsubscribe => {
    // 同一キーの二重登録を防ぐ
    off(params.key);

    // eventKeyを実イベント名へ変換
    const eventName = eventNameMap[params.eventKey];
    // CustomEvent.detailを型付きpayloadとして呼び出し側へ渡す
    const wrappedListener: EventListener = (event: Event): void => {
      const customEvent = event as CustomEvent<AppEventMap[K]>;
      params.listener(customEvent.detail);
    };

    // イベント登録
    params.target.addEventListener(eventName, wrappedListener, params.options);

    // イベント情報を記録
    registeredEvents.set(params.key, {
      target: params.target,
      eventName,
      listener: wrappedListener,
      options: params.options,
    });

    return () => {
      off(params.key);
    };
  };

  // 指定イベントを発火する関数
  const emit = <K extends AppEventKey>(params: {
    target: EventTarget;
    eventKey: K;
    payload: AppEventMap[K];
  }): void => {
    const eventName = eventNameMap[params.eventKey];
    params.target.dispatchEvent(new CustomEvent(eventName, { detail: params.payload }));
  };

  // 全イベント登録を解除する関数
  const clear = (): void => {
    // 競合回避のためキーを複製してから処理
    const keys = [...registeredEvents.keys()];
    for (const key of keys) off(key);
  };

  return {
    on,
    emit,
    off,
    clear,
    size: () => registeredEvents.size,
  };
};

// エクスポート
export { createEventRegistry };
