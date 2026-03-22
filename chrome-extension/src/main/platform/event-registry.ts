/**
 * イベントレジストリ
 */
import { appEventContractRecord, type AppEventKey, type AppEventMap, type AppEventNameMap } from "@main/config/event";
import { resolveDomainOrder, type DomainName } from "@main/domain/shared/domain-name";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { AppEventRegistry, Unsubscribe } from "@main/types/app-context";

// 登録済みイベントの保持型
type RegisteredEvent = {
  target: EventTarget;
  eventName: string;
  eventKey: AppEventKey;
  listenerDomain: DomainName;
  listener: EventListener;
  options?: AddEventListenerOptions;
};

const log = getLogger(appLoggerNames.eventRegistry);

// plain objectかどうかを判定する関数
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

// イベントpayloadをdispatch専用の読み取り専用値へ変換する関数
const createReadonlyEventPayloadValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => createReadonlyEventPayloadValue(entry)));
  }
  if (isPlainObject(value)) {
    const readonlyObject: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      readonlyObject[key] = createReadonlyEventPayloadValue(entry);
    }
    return Object.freeze(readonlyObject);
  }
  return value;
};

// NOTE: DOM要素などのlive objectはclone/freezeせず参照のまま通し、
// payloadの入れ物と配列・plain objectだけをread-only化する。
const createReadonlyEventPayload = <K extends AppEventKey>(payload: AppEventMap[K]): AppEventMap[K] =>
  createReadonlyEventPayloadValue(payload) as AppEventMap[K];

// イベントの登録、発火、解除を管理する関数
const createEventRegistry = (eventNameMap: AppEventNameMap): AppEventRegistry => {
  // 登録済みイベント情報
  const registeredEvents = new Map<string, RegisteredEvent>();
  // 指定イベントの契約を解決する関数
  const resolveEventContract = <K extends AppEventKey>(eventKey: K) => appEventContractRecord[eventKey];
  // イベントの違反検知をログ出力してエラーを投げる関数
  const throwContractViolation = (message: string): never => {
    log.error(message);
    throw new Error(message);
  };
  // listener登録時にイベント契約へ違反していないか判定する関数
  const assertCanRegisterListener = (params: {
    eventKey: AppEventKey;
    listenerDomain: DomainName;
  }): void => {
    const eventContract = resolveEventContract(params.eventKey);
    if (params.listenerDomain === eventContract.ownerDomain) return;
    if (!eventContract.allowCrossDomainEmit) {
      throwContractViolation(
        `event listener registration blocked: ${params.eventKey} owned by ${eventContract.ownerDomain} ` +
        `cannot register foreign listener owned by ${params.listenerDomain}`,
      );
    }
    // start順は listener-first order のため、cross-domain listener は owner より前だけ許可する。
    if (resolveDomainOrder(params.listenerDomain) < resolveDomainOrder(eventContract.ownerDomain)) return;

    throwContractViolation(
      `event listener registration blocked: ${params.eventKey} owned by ${eventContract.ownerDomain} ` +
      `cannot register listener owned by ${params.listenerDomain} after owner domain in bootstrap start order`,
    );
  };
  // emit時にイベント契約へ違反していないか判定する関数
  const assertCanEmitEvent = (params: {
    eventKey: AppEventKey;
    ownerDomain: DomainName;
  }): void => {
    const eventContract = resolveEventContract(params.eventKey);
    // 各eventは単一 ownerDomain だけが emit できる。
    if (params.ownerDomain !== eventContract.ownerDomain) {
      throwContractViolation(
        `event emit blocked: ${params.eventKey} from ${params.ownerDomain} ` +
        `must be emitted by ${eventContract.ownerDomain}`,
      );
    }
  };

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
    listenerDomain: DomainName;
    listener: (payload: AppEventMap[K]) => void;
    options?: AddEventListenerOptions;
  }): Unsubscribe => {
    assertCanRegisterListener(params);
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
      eventKey: params.eventKey,
      listenerDomain: params.listenerDomain,
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
    ownerDomain: DomainName;
    payload: AppEventMap[K];
  }): void => {
    assertCanEmitEvent(params);
    const eventName = eventNameMap[params.eventKey];
    const readonlyPayload = createReadonlyEventPayload(params.payload);
    log.debug(`----- Event Emitted ----- (event=${eventName})`, readonlyPayload);
    params.target.dispatchEvent(new CustomEvent(eventName, { detail: readonlyPayload }));
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
