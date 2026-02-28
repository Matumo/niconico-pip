/**
 * statusドメインブラウザテスト
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  expectBrowserConsoleLogContaining,
  expectNoBrowserConsoleWarnings,
  expectNoBrowserPageErrors,
} from "@test/shared/browser/browser-log-assertions";
import {
  startExtensionFixtureEnvironment,
  type ExtensionFixtureEnvironment,
} from "@test/browser-headless/shared/extension-fixture-environment";
import { executeHeadlessRuntimeTest } from "@test/browser-headless/shared/runtime-test/headless-bridge-client";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";

interface AppPageUrlChangedDetails {
  url: string;
  generation: number;
  isWatchPage: boolean;
}

interface VideoInfoFixture {
  title: string;
  author: string;
  thumbnail: string;
}

const videoInfoJsonLdFixturePath = resolve(__dirname, "../../fixtures/video-info.json");

let videoInfoJsonLdFixtureCache: Record<string, unknown> | null = null;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const loadVideoInfoJsonLdFixture = async (): Promise<Record<string, unknown>> => {
  if (videoInfoJsonLdFixtureCache) return videoInfoJsonLdFixtureCache;

  const jsonText = await readFile(videoInfoJsonLdFixturePath, "utf8");
  const parsed: unknown = JSON.parse(jsonText);
  if (!isObjectRecord(parsed)) {
    throw new TypeError("video-info json fixture must be an object");
  }

  videoInfoJsonLdFixtureCache = parsed;
  return parsed;
};

const createVideoInfoJsonLdFromFixture = (
  fixture: Record<string, unknown>,
  videoInfo: VideoInfoFixture,
): Record<string, unknown> => {
  const thumbnailEntries = Array.isArray(fixture.thumbnail) ?
    fixture.thumbnail.slice(1) : [];
  const thumbnailUrlEntries = Array.isArray(fixture.thumbnailUrl) ?
    fixture.thumbnailUrl.slice(1) : [];

  return {
    ...fixture,
    name: videoInfo.title,
    author: {
      ...(isObjectRecord(fixture.author) ? fixture.author : {}),
      "@type": "Person",
      name: videoInfo.author,
    },
    thumbnail: [
      {
        "@type": "ImageObject",
        url: videoInfo.thumbnail,
      },
      ...thumbnailEntries,
    ],
    thumbnailUrl: [
      videoInfo.thumbnail,
      ...thumbnailUrlEntries,
    ],
  };
};

const setVideoInfoJsonLd = async (
  page: Page,
  videoInfoJsonLd: Record<string, unknown>,
): Promise<void> => {
  await page.evaluate((nextJsonLd) => {
    const selector = 'script[data-test-role="video-info-jsonld"]';
    const existing = globalThis.document.querySelector(selector);
    const script = existing instanceof HTMLScriptElement ?
      existing : globalThis.document.createElement("script");

    script.type = "application/ld+json";
    script.dataset.testRole = "video-info-jsonld";
    script.textContent = JSON.stringify(nextJsonLd);

    if (!(existing instanceof HTMLScriptElement)) {
      globalThis.document.head.appendChild(script);
    }
  }, videoInfoJsonLd);
};

const emitPageUrlChanged = async (
  page: Page,
  runtimeTestPath: string,
  details: AppPageUrlChangedDetails,
): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "emitPageUrlChanged",
      url: details.url,
      generation: details.generation,
      isWatchPage: details.isWatchPage,
    },
  });
  expect(result.ok).toBe(true);
};

const waitForVideoInfoChanged = async (
  page: Page,
  runtimeTestPath: string,
  expected: {
    title: string | null;
    author: string | null;
    thumbnail: string | null;
  },
): Promise<void> => {
  await expect.poll(async () => {
    const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
      details: {
        command: "checkNewEvent",
        expectedTitle: expected.title,
        expectedAuthor: expected.author,
        expectedThumbnail: expected.thumbnail,
      },
    });
    return result.ok;
  }).toBe(true);
};

const expectNoNewVideoInfoChanged = async (page: Page, runtimeTestPath: string): Promise<void> => {
  const result = await executeHeadlessRuntimeTest(page, runtimeTestPath, {
    details: {
      command: "checkNoEvent",
    },
  });
  expect(result.ok).toBe(true);
};

test.describe("statusドメイン", () => {
  let environment: ExtensionFixtureEnvironment | null = null;

  test.beforeAll(async () => {
    environment = await startExtensionFixtureEnvironment();
  });

  test.afterAll(async () => {
    if (environment) {
      await environment.close();
      environment = null;
    }
  });

  test("PageUrlChanged(isWatchPage=true)で動画情報を同期して通知すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.statusTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        const videoInfoJsonLdFixture = await loadVideoInfoJsonLdFixture();
        await setVideoInfoJsonLd(session.page, {
          ...createVideoInfoJsonLdFromFixture(videoInfoJsonLdFixture, {
            title: "watch title",
            author: "watch author",
            thumbnail: "https://example.test/watch.jpg",
          }),
        });

        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await waitForVideoInfoChanged(session.page, runtimeTestPath, {
          title: "watch title",
          author: "watch author",
          thumbnail: "https://example.test/watch.jpg",
        });

        await setVideoInfoJsonLd(session.page, {
          ...createVideoInfoJsonLdFromFixture(videoInfoJsonLdFixture, {
            title: "next watch title",
            author: "next watch author",
            thumbnail: "https://example.test/next-watch.jpg",
          }),
        });
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm10",
          generation: Date.now() + 1,
          isWatchPage: true,
        });
        await waitForVideoInfoChanged(session.page, runtimeTestPath, {
          title: "next watch title",
          author: "next watch author",
          thumbnail: "https://example.test/next-watch.jpg",
        });

        await expectNoNewVideoInfoChanged(session.page, runtimeTestPath);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });

  test("PageUrlChanged(isWatchPage=false)で空スナップショット通知すること", async () => {
    if (!environment) {
      throw new Error("Extension fixture environment is not initialized");
    }

    const session = await environment.createSession();

    try {
      await session.goto("/");
      await expectBrowserConsoleLogContaining(session.logCollector, "bootstrap completed");

      const runtimeTestPath = runtimeTestPathMap.main.domain.statusTest;
      const initializeResult = await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
        details: {
          command: "init",
        },
      });
      expect(initializeResult.ok).toBe(true);

      try {
        const videoInfoJsonLdFixture = await loadVideoInfoJsonLdFixture();
        await setVideoInfoJsonLd(session.page, {
          ...createVideoInfoJsonLdFromFixture(videoInfoJsonLdFixture, {
            title: "watch title",
            author: "watch author",
            thumbnail: "https://example.test/watch.jpg",
          }),
        });
        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/watch/sm9",
          generation: Date.now(),
          isWatchPage: true,
        });
        await waitForVideoInfoChanged(session.page, runtimeTestPath, {
          title: "watch title",
          author: "watch author",
          thumbnail: "https://example.test/watch.jpg",
        });

        await emitPageUrlChanged(session.page, runtimeTestPath, {
          url: "https://www.nicovideo.jp/ranking",
          generation: Date.now() + 1,
          isWatchPage: false,
        });
        await waitForVideoInfoChanged(session.page, runtimeTestPath, {
          title: null,
          author: null,
          thumbnail: null,
        });

        await setVideoInfoJsonLd(session.page, {
          ...createVideoInfoJsonLdFromFixture(videoInfoJsonLdFixture, {
            title: "next title",
            author: "next author",
            thumbnail: "https://example.test/next.jpg",
          }),
        });
        await expectNoNewVideoInfoChanged(session.page, runtimeTestPath);
      } finally {
        await executeHeadlessRuntimeTest(session.page, runtimeTestPath, {
          details: {
            command: "reset",
          },
        }).catch(() => undefined);
      }

      expectNoBrowserConsoleWarnings(session.logCollector);
      expectNoBrowserPageErrors(session.logCollector);
    } finally {
      await session.close();
    }
  });
});
