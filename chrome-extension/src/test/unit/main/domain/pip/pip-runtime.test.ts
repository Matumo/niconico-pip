/**
 * pipドメインランタイム補助テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import {
  canUseNativeEventApi,
  hasAnyPipElement,
  resolveEventTarget,
} from "@main/domain/pip/pip-runtime";

const globalPropertyKeys = ["dispatchEvent", "addEventListener", "removeEventListener", "document"] as const;

describe("pipドメインランタイム補助", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
    vi.restoreAllMocks();
  });

  test("global event targetを解決できること", () => {
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    expect(resolveEventTarget()).toBe(globalThis);

    setGlobalProperty("dispatchEvent", undefined);
    expect(resolveEventTarget()).toBeNull();
  });

  test("native event APIの利用可否を判定できること", () => {
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());
    expect(canUseNativeEventApi()).toBe(true);

    setGlobalProperty("removeEventListener", undefined);
    expect(canUseNativeEventApi()).toBe(false);
  });

  test("PiP要素の有無を判定できること", () => {
    setGlobalProperty("document", {
      pictureInPictureElement: null,
    } satisfies Pick<Document, "pictureInPictureElement">);
    expect(hasAnyPipElement()).toBe(false);

    setGlobalProperty("document", {
      pictureInPictureElement: {} as Element,
    } satisfies Pick<Document, "pictureInPictureElement">);
    expect(hasAnyPipElement()).toBe(true);
  });
});
