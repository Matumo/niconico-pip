"use strict";

// 汎用的な簡易キャッシュ + ロードステータス管理ユーティリティ
// 状態: none, loading, loaded, error
// 各エントリ: { status, data, lastUpdated, retryCount }

// --- function ----------------------------------------------------------------
let cache_getStatus = null;
let cache_getData = null;
let cache_set = null;
let cache_canRetry = null;
// -----------------------------------------------------------------------------

{
  const cacheStore = Object.create(null);
  const DEFAULT_RETRY_INTERVAL = 5 * 1000; // ms
  const MAX_RETRY_COUNT = 3; // 最大リトライ回数

  // キャッシュ初期化/リセット
  function cache_resetCache(key) {
    cacheStore[key] = { status: "none", data: null, lastUpdated: 0, retryCount: 0 };
  }

  // エントリ取得（内部用）
  function cache_getEntry(key) {
    if (!cacheStore[key]) cache_resetCache(key);
    return cacheStore[key];
  }

  // ステータス取得
  cache_getStatus = function (key) {
    return cache_getEntry(key).status;
  };

  // データ取得
  cache_getData = function (key) {
    return cache_getEntry(key).data;
  };

  // ステータスとデータを更新
  cache_set = function (key, status, data) {
    const entry = cache_getEntry(key);
    entry.status = status;
    entry.data = data;
    entry.lastUpdated = performance.now();
    if (status === "error") {
      entry.retryCount += 1;
    } else {
      entry.retryCount = 0;
    }
  };

  // リトライ可能判定
  cache_canRetry = function (key, retryIntervalMs = DEFAULT_RETRY_INTERVAL) {
    const entry = cache_getEntry(key);
    if (entry.retryCount >= MAX_RETRY_COUNT) return false; // 上限到達
    return performance.now() - entry.lastUpdated > retryIntervalMs;
  };
}
