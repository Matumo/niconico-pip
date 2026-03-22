/**
 * media-sessionドメインテスト
 */
import { describe, expect, test } from "vitest";
import { createMediaSessionDomain } from "@main/domain/media-session";

describe("media-sessionドメイン", () => {
  test("名前が期待どおりであること", () => {
    const domain = createMediaSessionDomain();

    expect(domain.name).toBe("media-session");
  });
});
