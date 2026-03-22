/**
 * create-domain-moduleテスト
 */
import { describe, expect, test, vi } from "vitest";
import { createDomainModule } from "@main/domain/shared/create-domain-module";

vi.mock("@matumo/ts-simple-logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("create-domain-module", () => {
  test("nameを保持したドメイン骨格を返すこと", () => {
    const module = createDomainModule("elements");

    expect(module.name).toBe("elements");
  });

  test("stop後は再度initしないとstartできないこと", async () => {
    const module = createDomainModule("elements");

    await module.init({} as never, {} as never);
    await module.start();
    await module.stop();

    await expect(module.start()).rejects.toThrowError(/must be initialized/);
  });

  test("stop後に再initすれば再startできること", async () => {
    const module = createDomainModule("elements");

    await module.init({} as never, {} as never);
    await module.start();
    await module.stop();
    await module.init({} as never, {} as never);

    await expect(module.start()).resolves.toBeUndefined();
  });
});
