/**
 * safe-runnerテスト
 */
import { describe, expect, test } from "vitest";
import { createSafeRunner } from "@main/platform/safe-runner";
import { createMockLogger } from "@test/unit/main/helpers/logger";

describe("safe-runner", () => {
  test("成功時にok結果を返すこと", async () => {
    const logger = createMockLogger("test-safe-runner");
    const safeRunner = createSafeRunner(logger);

    const sync = safeRunner.run("sync", () => 123);
    const asyncResult = await safeRunner.runAsync("async", async () => 456);

    expect(sync).toEqual({ ok: true, value: 123 });
    expect(asyncResult).toEqual({ ok: true, value: 456 });
  });

  test("失敗時に例外を投げずエラー結果を返すこと", async () => {
    const logger = createMockLogger("test-safe-runner");
    const safeRunner = createSafeRunner(logger);

    const sync = safeRunner.run("sync", () => {
      throw new Error("sync-fail");
    });

    const asyncResult = await safeRunner.runAsync("async", async () => {
      throw new Error("async-fail");
    });

    expect(sync.ok).toBe(false);
    expect(asyncResult.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
