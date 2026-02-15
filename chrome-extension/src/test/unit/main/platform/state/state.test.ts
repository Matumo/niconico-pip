/**
 * stateテスト
 */
import { describe, expect, test } from "vitest";
import { createAppStateContainer } from "@main/platform/state";
import { createOwnedSlice } from "@main/platform/state/create-owned-slice";

describe("stateストア", () => {
  test("初期stateを取得できること", () => {
    const store = createAppStateContainer().state;

    expect(store.page.get()).toEqual({
      url: "",
      isWatchPage: false,
      generation: 0,
    });
    expect(store.status.get().playbackStatus).toBe("idle");
    expect(store.info.get().title).toBeNull();
  });

  test("storeは読み取り専用sliceのみ公開すること", () => {
    const store = createAppStateContainer().state;

    expect("set" in store.page).toBe(false);
    expect("patch" in store.page).toBe(false);
    expect("reset" in store.page).toBe(false);
    expect("owners" in store).toBe(false);
  });

  test("writer経由でset/patch/resetできること", () => {
    const owned = createOwnedSlice({
      currentTime: 0,
      duration: 0,
    });

    owned.writer.set({ currentTime: 5, duration: 10 });
    expect(owned.slice.get()).toEqual({ currentTime: 5, duration: 10 });

    owned.writer.patch({ currentTime: 12 });
    expect(owned.slice.get()).toEqual({ currentTime: 12, duration: 10 });

    owned.writer.reset();
    expect(owned.slice.get()).toEqual({ currentTime: 0, duration: 0 });
  });

  test("setは受け取ったstateをcloneして保持すること", () => {
    const owned = createOwnedSlice({ count: 0 });
    const nextState = { count: 1 };

    owned.writer.set(nextState);
    nextState.count = 99;

    expect(owned.slice.get().count).toBe(1);
    expect(owned.slice.get()).not.toBe(nextState);
  });

  test("resetは作成時のstateスナップショットへ戻すこと", () => {
    const initialState = { count: 1 };
    const owned = createOwnedSlice(initialState);

    initialState.count = 999;
    owned.writer.set({ count: 5 });
    owned.writer.reset();

    expect(owned.slice.get().count).toBe(1);
  });
});
