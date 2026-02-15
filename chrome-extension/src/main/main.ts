/**
 * エントリーポイント
 */
import { bootstrap } from "@main/bootstrap/bootstrap";
import { getLogger } from "@matumo/ts-simple-logger";

const log = getLogger("main");

// 起動処理を開始して未捕捉エラーを出力する
const runMain = async (): Promise<void> => {
  try {
    const startedAt = performance.now();
    await bootstrap();
    const elapsedMs = performance.now() - startedAt;
    log.info(`bootstrap completed (${elapsedMs.toFixed(1)}ms)`);
  } catch (error: unknown) {
    log.error("bootstrap failed:", error);
  }
};

void runMain();
