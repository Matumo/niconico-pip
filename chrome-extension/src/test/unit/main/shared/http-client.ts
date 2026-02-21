/**
 * テスト用HTTPクライアントヘルパー
 */
import type { AppHttpClient } from "@main/types/app-context";
import { vi } from "vitest";

// 呼び出し禁止メソッドを作成する関数
const createForbiddenMethod = (methodName: string, scope: string) =>
  vi.fn(() => {
    throw new Error(`httpClient.${methodName} should not be called in ${scope}`);
  });

// テスト中に呼び出されるべきでないHTTPクライアントモックを作成する関数
const createForbiddenHttpClient = (scope: string): AppHttpClient => ({
  client: {} as AppHttpClient["client"],
  request: createForbiddenMethod("request", scope) as unknown as AppHttpClient["request"],
  get: createForbiddenMethod("get", scope) as unknown as AppHttpClient["get"],
  post: createForbiddenMethod("post", scope) as unknown as AppHttpClient["post"],
  put: createForbiddenMethod("put", scope) as unknown as AppHttpClient["put"],
  patch: createForbiddenMethod("patch", scope) as unknown as AppHttpClient["patch"],
  delete: createForbiddenMethod("delete", scope) as unknown as AppHttpClient["delete"],
  head: createForbiddenMethod("head", scope) as unknown as AppHttpClient["head"],
  clearCache: vi.fn(),
  clearInFlight: vi.fn(),
});

// エクスポート
export { createForbiddenHttpClient };
