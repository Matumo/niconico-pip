/**
 * PiP動画要素 poster変換キャッシュテスト
 */
import { describe, expect, test } from "vitest";
import {
  createPosterDataUrlCache,
} from "@main/adapter/media/pip-video-element/pip-video-element-poster-cache";

describe("PiP動画要素 poster変換キャッシュ", () => {
  test("同じ画像でkeyパラメーターだけ異なるURLは同じcache entryを返すこと", async () => {
    const cache = createPosterDataUrlCache({
      maxEntries: 3,
    });
    const posterDataUrlPromise = Promise.resolve("data:image/png;base64,converted");

    cache.set("https://example.test/thumb.jpg?key=aaa&foo=1", posterDataUrlPromise);

    await expect(cache.get("https://example.test/thumb.jpg?foo=1&key=bbb")).resolves.toBe(
      "data:image/png;base64,converted",
    );
  });

  test("key以外のquery差分は別cache entryとして扱うこと", () => {
    const cache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    cache.set("https://example.test/thumb.jpg?foo=1&key=aaa", Promise.resolve("data:foo1"));

    expect(cache.get("https://example.test/thumb.jpg?foo=2&key=bbb")).toBeUndefined();
  });

  test("deleteは正規化済みcache keyに対しても削除できること", () => {
    const cache = createPosterDataUrlCache({
      maxEntries: 3,
    });
    const posterDataUrlPromise = Promise.resolve("data:image/png;base64,converted");

    cache.set("https://example.test/thumb.jpg?key=aaa&foo=1", posterDataUrlPromise);
    cache.delete("https://example.test/thumb.jpg?foo=1&key=bbb");

    expect(cache.get("https://example.test/thumb.jpg?foo=1&key=ccc")).toBeUndefined();
  });

  test("無効URL文字列もそのままcache keyとして扱うこと", async () => {
    const cache = createPosterDataUrlCache({
      maxEntries: 3,
    });
    const posterDataUrlPromise = Promise.resolve("data:invalid");

    cache.set("not a valid url %%%", posterDataUrlPromise);
    await expect(cache.get("not a valid url %%%")).resolves.toBe("data:invalid");

    cache.delete("not a valid url %%%");
    expect(cache.get("not a valid url %%%")).toBeUndefined();
  });

  test("FIFOで最大件数を超えたら最古entryから破棄すること", async () => {
    const cache = createPosterDataUrlCache({
      maxEntries: 3,
    });

    cache.set("https://example.test/1.jpg?key=a", Promise.resolve("data:1"));
    cache.set("https://example.test/2.jpg?key=a", Promise.resolve("data:2"));
    cache.set("https://example.test/3.jpg?key=a", Promise.resolve("data:3"));
    cache.set("https://example.test/2.jpg?key=b", Promise.resolve("data:2b"));
    cache.set("https://example.test/4.jpg?key=a", Promise.resolve("data:4"));

    expect(cache.get("https://example.test/1.jpg?key=b")).toBeUndefined();
    await expect(cache.get("https://example.test/2.jpg?key=c")).resolves.toBe("data:2b");
    await expect(cache.get("https://example.test/3.jpg?key=b")).resolves.toBe("data:3");
    await expect(cache.get("https://example.test/4.jpg?key=b")).resolves.toBe("data:4");
  });

  test("maxEntries未指定時も既定値3件でFIFO破棄すること", async () => {
    const cache = createPosterDataUrlCache({});

    cache.set("https://example.test/a.jpg?key=1", Promise.resolve("data:a"));
    cache.set("https://example.test/b.jpg?key=1", Promise.resolve("data:b"));
    cache.set("https://example.test/c.jpg?key=1", Promise.resolve("data:c"));
    cache.set("https://example.test/d.jpg?key=1", Promise.resolve("data:d"));

    expect(cache.get("https://example.test/a.jpg?key=2")).toBeUndefined();
    await expect(cache.get("https://example.test/b.jpg?key=2")).resolves.toBe("data:b");
    await expect(cache.get("https://example.test/c.jpg?key=2")).resolves.toBe("data:c");
    await expect(cache.get("https://example.test/d.jpg?key=2")).resolves.toBe("data:d");
  });

  test("負のmaxEntriesでも無限ループせずentryを保持しないこと", () => {
    const cache = createPosterDataUrlCache({
      maxEntries: -1,
    });

    cache.set("https://example.test/negative.jpg?key=1", Promise.resolve("data:negative"));

    expect(cache.get("https://example.test/negative.jpg?key=2")).toBeUndefined();
  });
});
