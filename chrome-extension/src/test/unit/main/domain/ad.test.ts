/**
 * adドメインテスト
 */
import { describe, expect, test } from "vitest";
import { createAdDomain } from "@main/domain/ad";

describe("adドメイン", () => {
  test("名前とphaseが期待どおりであること", () => {
    const domain = createAdDomain();

    expect(domain.name).toBe("ad");
    expect(domain.phase).toBe("presentation");
  });
});
