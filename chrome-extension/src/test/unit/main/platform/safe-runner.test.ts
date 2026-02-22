/**
 * safe-runnerテスト
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";
import type { TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

let createSafeRunner: typeof import("@main/platform/safe-runner").createSafeRunner;
let loggerMockHarness: TsSimpleLoggerMockHarness;

describe("safe-runner", () => {
  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createSafeRunner } = await import("@main/platform/safe-runner"));
    loggerMockHarness.clearLoggerCalls();
  });

  test("成功時にok結果を返すこと", async () => {
    const safeRunner = createSafeRunner();

    const sync = safeRunner.run("sync", () => 123);
    const asyncResult = await safeRunner.runAsync("async", async () => 456);

    expect(sync).toEqual({ ok: true, value: 123 });
    expect(asyncResult).toEqual({ ok: true, value: 456 });
  });

  test("失敗時に例外を投げずエラー結果を返すこと", async () => {
    const safeRunner = createSafeRunner();

    const sync = safeRunner.run("sync", () => {
      throw new Error("sync-fail");
    });

    const asyncResult = await safeRunner.runAsync("async", async () => {
      throw new Error("async-fail");
    });
    const safeRunnerLogger = loggerMockHarness.resolveMockLogger("safe-runner");

    expect(sync.ok).toBe(false);
    expect(asyncResult.ok).toBe(false);
    expect(safeRunnerLogger.error).toHaveBeenCalledTimes(2);
  });
});
