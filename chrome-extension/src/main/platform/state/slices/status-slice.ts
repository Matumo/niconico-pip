/**
 * statusスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { StatusState } from "@main/types/app-context";

// statusスライスの初期state
const initialStatusState: StatusState = {
  playbackStatus: "idle",
};

// statusスライスを作成する関数
const createStatusSlice = (): OwnedSlice<StatusState> => createOwnedSlice(initialStatusState);

// エクスポート
export { createStatusSlice };
