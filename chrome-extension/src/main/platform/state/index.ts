/**
 * stateストア生成
 */
import { createElementsSlice } from "@main/platform/state/slices/elements-slice";
import { createInfoSlice } from "@main/platform/state/slices/info-slice";
import { createPageSlice } from "@main/platform/state/slices/page-slice";
import { createPipSlice } from "@main/platform/state/slices/pip-slice";
import { createStatusSlice } from "@main/platform/state/slices/status-slice";
import { createTimeSlice } from "@main/platform/state/slices/time-slice";
import type { AppStateStore, AppStateWriters } from "@main/types/app-context";

// state公開値とwriterを束ねた型
interface AppStateContainer {
  state: AppStateStore;
  writers: AppStateWriters;
}

// アプリ全体のstate公開値とwriterを作成する関数
const createAppStateContainer = (): AppStateContainer => {
  const page = createPageSlice();
  const elements = createElementsSlice();
  const status = createStatusSlice();
  const time = createTimeSlice();
  const pip = createPipSlice();
  const info = createInfoSlice();

  return {
    state: {
      page: page.slice,
      elements: elements.slice,
      status: status.slice,
      time: time.slice,
      pip: pip.slice,
      info: info.slice,
    },
    writers: {
      page: page.writer,
      elements: elements.writer,
      status: status.writer,
      time: time.writer,
      pip: pip.writer,
      info: info.writer,
    },
  };
};

// エクスポート
export { createAppStateContainer };
export type { AppStateContainer };
