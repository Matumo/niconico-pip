/**
 * timeドメインテスト
 */
import { describe, expect, test } from "vitest";
import { createTimeDomain } from "@main/domain/time";

describe("timeドメイン", () => {
  test("名前が期待どおりであること", () => {
    const domain = createTimeDomain();

    expect(domain.name).toBe("time");
  });
});
