/**
 * timeスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { TimeState } from "@main/types/app-context";

// timeスライスの初期state
const initialTimeState: TimeState = {
  currentTime: 0,
  duration: 0,
};

// timeスライスを作成する関数
const createTimeSlice = (): OwnedSlice<TimeState> => createOwnedSlice(initialTimeState);

// エクスポート
export { createTimeSlice };
