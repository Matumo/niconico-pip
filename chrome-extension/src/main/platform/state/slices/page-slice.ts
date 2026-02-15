/**
 * pageスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { PageState } from "@main/types/app-context";

// pageスライスの初期state
const initialPageState: PageState = {
  url: "",
  isWatchPage: false,
  generation: 0,
};

// pageスライスを作成する関数
const createPageSlice = (): OwnedSlice<PageState> => createOwnedSlice(initialPageState);

// エクスポート
export { createPageSlice };
