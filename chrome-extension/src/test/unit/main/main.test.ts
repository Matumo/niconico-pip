/**
 * mainテスト
 */
import { describe, expect, test, vi } from "vitest";
import { createMockLogger } from "@test/unit/main/helpers/logger";

describe("mainエントリー", () => {
  test("bootstrapを呼び出すこと", async () => {
    const logger = createMockLogger("test-main");
    const bootstrap = vi.fn(async () => ({
      context: {},
      stop: async () => undefined,
    }));

    vi.resetModules();
    vi.doMock("@main/bootstrap/bootstrap", () => ({
      bootstrap,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => ({
      getLogger: vi.fn(() => logger),
    }));

    await import("@main/main");
    await Promise.resolve();

    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("bootstrap completed"));
  });

  test("bootstrap失敗時にエラーを出力すること", async () => {
    const error = new Error("boot-failed");
    const bootstrap = vi.fn(async () => {
      throw error;
    });
    const logger = createMockLogger("test-main");

    vi.resetModules();
    vi.doMock("@main/bootstrap/bootstrap", () => ({
      bootstrap,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => ({
      getLogger: vi.fn(() => logger),
    }));

    await import("@main/main");
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("bootstrap failed:", error);
  });
});
