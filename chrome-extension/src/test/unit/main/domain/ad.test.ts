/**
 * adドメインテスト
 */
import { describe, expect, test } from "vitest";
import { createAdDomain } from "@main/domain/ad";

describe("adドメイン", () => {
  test("名前が期待どおりであること", () => {
    const domain = createAdDomain();

    expect(domain.name).toBe("ad");
  });
});
