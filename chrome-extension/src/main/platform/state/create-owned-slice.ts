/**
 * stateスライス生成
 */
import type { AppStateSlice, AppStateWriter } from "@main/types/app-context";

// 公開slice（読み取り専用）と更新writerの組み合わせ型
interface OwnedSlice<TState> {
  slice: AppStateSlice<TState>;
  writer: AppStateWriter<TState>;
}

// 公開sliceと更新writerを作成する関数
const createOwnedSlice = <TState extends object>(initialState: TState): OwnedSlice<TState> => {
  // 呼び出し元でinitialStateが変更されてもreset基準が崩れないように退避
  const initialSnapshot = structuredClone(initialState);
  let state = structuredClone(initialSnapshot);

  return {
    slice: {
      // 現在stateの読み取り専用ビューを返す関数
      get: (): Readonly<TState> => state as Readonly<TState>,
    },
    writer: {
      // stateを置換する関数
      set: (nextState: TState): void => {
        state = structuredClone(nextState);
      },
      // stateを部分更新する関数
      patch: (partialState: Partial<TState>): void => {
        Object.assign(state, partialState);
      },
      // 初期stateへ戻す関数
      reset: (): void => {
        state = structuredClone(initialSnapshot);
      },
    },
  };
};

// エクスポート
export { createOwnedSlice };
export type { OwnedSlice };
