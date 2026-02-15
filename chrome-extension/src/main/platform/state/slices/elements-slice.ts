/**
 * elementsスライス
 */
import { createOwnedSlice, type OwnedSlice } from "@main/platform/state/create-owned-slice";
import type { ElementsState } from "@main/types/app-context";

// elementsスライスの初期state
const initialElementsState: ElementsState = {
  lastResolvedGeneration: 0,
  lastResolvedAt: null,
};

// elementsスライスを作成する関数
const createElementsSlice = (): OwnedSlice<ElementsState> => createOwnedSlice(initialElementsState);

// エクスポート
export { createElementsSlice };
