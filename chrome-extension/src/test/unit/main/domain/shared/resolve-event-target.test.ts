/**
 * domain共通 EventTarget解決テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { resolveEventTarget } from "@main/domain/shared/resolve-event-target";

const globalPropertyKeys = ["dispatchEvent"] as const;

describe("domain共通 EventTarget解決", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
    vi.restoreAllMocks();
  });

  test("dispatchEventを持つglobalThisをEventTargetとして返すこと", () => {
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    expect(resolveEventTarget()).toBe(globalThis);
  });

  test("dispatchEventがない場合はnullを返すこと", () => {
    setGlobalProperty("dispatchEvent", undefined);

    expect(resolveEventTarget()).toBeNull();
  });
});
