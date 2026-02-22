/**
 * HTTPクライアント
 */
import type { HttpPolicy, RetryPolicy } from "@main/config/http";
import { appLoggerNames } from "@main/platform/logger";
import type { AppHttpClient } from "@main/types/app-context";
import { getLogger } from "@matumo/ts-simple-logger";
import ky, { type Input, type Options, type ResponsePromise, type RetryOptions } from "ky";

// createHttpClientの入力型
interface CreateHttpClientOptions {
  policy: HttpPolicy;      // HTTPの実行ポリシー（timeout/retryなど）
  fetchFn?: typeof fetch;  // fetch実装（オプション）
  randomFn?: () => number; // バックオフジッター計算に使う乱数関数（オプション）
}

const log = getLogger(appLoggerNames.http);

// リトライ待機時間を計算する関数
const computeBackoffMs = (
  retryPolicy: RetryPolicy,
  attempt: number,
  randomFn: () => number,
): number => {
  const exponentialDelay = retryPolicy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const boundedDelay = Math.min(retryPolicy.maxDelayMs, exponentialDelay);
  const jitter = boundedDelay * retryPolicy.jitterRatio * randomFn();
  return Math.round(boundedDelay + jitter);
};

// アプリのリトライ方針をkyのretry設定へ変換する関数
const createKyRetryOptions = (
  retryPolicy: RetryPolicy,
  randomFn: () => number,
): RetryOptions => ({
  limit: Math.max(0, retryPolicy.maxAttempts - 1),
  statusCodes: retryPolicy.retryOnStatuses,
  backoffLimit: retryPolicy.maxDelayMs,
  retryOnTimeout: true,
  delay: (attemptCount): number => computeBackoffMs(retryPolicy, attemptCount, randomFn),
});

// kyベースのHTTPクライアントを作成する関数
const createHttpClient = (options: CreateHttpClientOptions): AppHttpClient => {
  // 依存を初期化
  const fetchFn = options.fetchFn ?? fetch;
  const randomFn = options.randomFn ?? Math.random;
  const retryOptions = createKyRetryOptions(options.policy.retry, randomFn);

  // 既定ポリシーでkyクライアントを生成
  const client = ky.create({
    fetch: fetchFn,
    timeout: options.policy.timeoutMs,
    throwHttpErrors: true,
    retry: retryOptions,
    hooks: {
      beforeRetry: [
        ({ request, retryCount, error }): void => {
          log.warn("Retrying HTTP request", {
            url: request.url,
            retryCount,
            errorName: error.name,
          });
        },
      ],
    },
  });

  // 汎用request関数
  const request = <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
    client<TData>(input, requestOptions);

  // 呼び出し側へ公開するAPI
  return {
    client,
    request,
    get: <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
      client.get<TData>(input, requestOptions),
    post: <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
      client.post<TData>(input, requestOptions),
    put: <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
      client.put<TData>(input, requestOptions),
    patch: <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
      client.patch<TData>(input, requestOptions),
    delete: <TData = unknown>(input: Input, requestOptions?: Options): ResponsePromise<TData> =>
      client.delete<TData>(input, requestOptions),
    head: (input: Input, requestOptions?: Options): ResponsePromise<unknown> =>
      client.head(input, requestOptions),
    clearCache: (): void => undefined,
    clearInFlight: (): void => undefined,
  };
};

// エクスポート
export { createHttpClient };
