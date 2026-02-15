/**
 * pipスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { PipState } from "@main/types/app-context";

// pipスライスの初期state
const initialPipState: PipState = {
  enabled: false,
  reason: "unknown",
};

// pipスライスを作成する関数
const createPipSlice = (): OwnedSlice<PipState> => createOwnedSlice(initialPipState);

// エクスポート
export { createPipSlice };
