/**
 * infoスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { InfoState } from "@main/types/app-context";

// infoスライスの初期state
const initialInfoState: InfoState = {
  title: null,
  videoId: null,
};

// infoスライスを作成する関数
const createInfoSlice = (): OwnedSlice<InfoState> => createOwnedSlice(initialInfoState);

// エクスポート
export { createInfoSlice };
