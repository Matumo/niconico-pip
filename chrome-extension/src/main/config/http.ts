/**
 * HTTP設定
 */
// リトライ設定型
interface RetryPolicy {
  maxAttempts: number;        // 最大試行回数（初回を含む）
  baseDelayMs: number;        // バックオフの基準待機時間(ms)
  maxDelayMs: number;         // バックオフ待機時間の上限(ms)
  jitterRatio: number;        // 待機時間へ加算するジッター率
  retryOnStatuses: number[];  // リトライ対象のHTTPステータスコード
}

// キャッシュ設定型
interface CachePolicy {
  enabled: boolean;      // キャッシュ機能を有効化するか
  defaultTtlMs: number;  // 既定のキャッシュ有効期限(ms)
  maxEntries: number;    // キャッシュ最大保持件数
}

// HTTPポリシー型
interface HttpPolicy {
  timeoutMs: number;   // リクエストタイムアウト(ms)
  dedupe: boolean;     // 同一リクエストの重複排除を有効化するか
  retry: RetryPolicy;  // リトライ方針
  cache: CachePolicy;  // キャッシュ方針
}

// HTTPポリシー上書き型
interface HttpPolicyOverrides {
  timeoutMs?: number;            // タイムアウト上書き(ms)
  dedupe?: boolean;              // 重複排除設定の上書き
  retry?: Partial<RetryPolicy>;  // リトライ設定の部分上書き
  cache?: Partial<CachePolicy>;  // キャッシュ設定の部分上書き
}

// 既定のHTTPポリシー
const defaultHttpPolicy: HttpPolicy = {
  timeoutMs: 8000,
  dedupe: true,
  retry: {
    maxAttempts: 3,
    baseDelayMs: 250,
    maxDelayMs: 2000,
    jitterRatio: 0.2,
    retryOnStatuses: [408, 425, 429, 500, 502, 503, 504],
  },
  cache: {
    enabled: true,
    defaultTtlMs: 30_000,
    maxEntries: 100,
  },
};

// 既定値に上書きを適用してHTTPポリシーを作成する関数
const mergeHttpPolicy = (overrides: HttpPolicyOverrides = {}): HttpPolicy => ({
  ...defaultHttpPolicy,
  ...overrides,
  retry: {
    ...defaultHttpPolicy.retry,
    ...overrides.retry,
  },
  cache: {
    ...defaultHttpPolicy.cache,
    ...overrides.cache,
  },
});

// エクスポート
export { mergeHttpPolicy };
export type { RetryPolicy, CachePolicy, HttpPolicy, HttpPolicyOverrides };
