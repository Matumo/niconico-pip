/**
 * infoスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { InfoState } from "@main/types/app-context";

// infoスライスの初期state
const initialInfoState: InfoState = {
  title: null,
  author: null,
  thumbnail: null,
  pageGeneration: 0,
  infoGeneration: 0,
};

// infoスライスを作成する関数
const createInfoSlice = (): OwnedSlice<InfoState> => createOwnedSlice(initialInfoState);

// エクスポート
export { createInfoSlice };
