/**
 * controllerドメインテスト
 */
import { describe, expect, test } from "vitest";
import { createControllerDomain } from "@main/domain/controller";

describe("controllerドメイン", () => {
  test("名前とphaseが期待どおりであること", () => {
    const domain = createControllerDomain();

    expect(domain.name).toBe("controller");
    expect(domain.phase).toBe("control");
  });
});
