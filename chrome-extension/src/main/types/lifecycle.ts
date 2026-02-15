/**
 * ライフサイクル管理インターフェース
 */
import type { AppContext, AppStateWriters } from "@main/types/app-context";

// 初期化、開始、停止のインターフェース
interface Lifecycle {
  // 初期化する関数
  init(context: AppContext, stateWriters: AppStateWriters): void | Promise<void>;
  // 処理を開始する関数
  start(): void | Promise<void>;
  // 処理を停止する関数
  stop(): void | Promise<void>;
}

// エクスポート
export type { Lifecycle };
