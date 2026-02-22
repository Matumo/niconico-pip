/**
 * createAppContextテスト
 */
import { describe, expect, test, vi } from "vitest";
import { createAppContext } from "@main/bootstrap/create-app-context";
import { createAppConfig } from "@main/config/config";
import { createAppStateContainer } from "@main/platform/state";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
} from "@test/unit/main/shared/global-property";

const createObserver = (): MutationObserver =>
  ({
    observe: () => undefined,
    disconnect: () => undefined,
    takeRecords: () => [],
  }) as MutationObserver;

// createAppContextへ注入する依存を作成する関数
const createDependencies = () => ({
  config: createAppConfig(),
});

describe("createAppContext", () => {
  test("注入依存でコンテキストを作成できること", async () => {
    const stateContainer = createAppStateContainer();
    const root = {
      querySelector: vi.fn(() => null),
    };

    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );

    const context = createAppContext(
      stateContainer.state,
      createDependencies(),
      {
        root,
        fetchFn: fetchFn as unknown as typeof fetch,
        randomFn: () => 0,
        createObserver,
      },
    );

    expect(context.config.appName).toBe("niconico-pip");
    expect(context.state.page.get().generation).toBe(0);

    const response = await context.httpClient.request("https://test.localhost/context").json<{
      ok: boolean;
    }>();

    expect(response.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("非ブラウザ環境でroot未注入でも動作すること", () => {
    const stateContainer = createAppStateContainer();
    const context = createAppContext(
      stateContainer.state,
      createDependencies(),
      {
        fetchFn: (async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
          })) as unknown as typeof fetch,
        createObserver,
      },
    );

    expect(context.elementResolver.resolve("video")).toBeNull();
  });

  test("ブラウザdocumentとHTTP上書き設定を利用できること", async () => {
    const stateContainer = createAppStateContainer();
    const globalDescriptors = captureGlobalDescriptors(["document"] as const);
    const fakeVideo = { tagName: "VIDEO", isConnected: true } as unknown as HTMLVideoElement;
    const querySelector = vi.fn(() => fakeVideo as unknown as Element);
    setGlobalProperty("document", { querySelector });

    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );

    try {
      const context = createAppContext(
        stateContainer.state,
        createDependencies(),
        {
          fetchFn: fetchFn as unknown as typeof fetch,
          httpPolicy: {
            timeoutMs: 1234,
            cache: { enabled: false },
          },
          createObserver,
        },
      );

      const resolved = context.elementResolver.resolve("video");
      expect(resolved).toBe(fakeVideo);
      expect(querySelector).toHaveBeenCalled();

      await context.httpClient.request("https://test.localhost/http-policy").json();

      await context.httpClient.request("https://test.localhost/http-policy").json();
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("stateを注入した場合は注入値を利用すること", () => {
    const stateContainer = createAppStateContainer();
    const context = createAppContext(
      stateContainer.state,
      createDependencies(),
      {
        fetchFn: (async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
          })) as unknown as typeof fetch,
        createObserver,
      },
    );

    stateContainer.writers.page.patch({ generation: 3 });

    expect(context.state.page.get().generation).toBe(3);
  });
});
