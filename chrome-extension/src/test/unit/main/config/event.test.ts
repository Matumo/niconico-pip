/**
 * event設定テスト
 */
import { describe, expect, test } from "vitest";
import { createAppEventNameMap } from "@main/config/event";
import { createAppConfig } from "@main/config/config";

describe("event設定", () => {
  test("prefix付きイベント名を作成すること", () => {
    const eventNames = createAppEventNameMap("prefix");
    expect(eventNames.PageUrlChanged).toBe("prefix-page-url-changed");
    expect(eventNames.PipStatusChanged).toBe("prefix-pip-status-changed");
  });

  test("既定prefixからイベント名を作成できること", () => {
    const config = createAppConfig();
    const eventNames = createAppEventNameMap(config.prefixId);
    expect(eventNames.PageUrlChanged).toBe(
      `${config.prefixId}-page-url-changed`,
    );
  });
});
