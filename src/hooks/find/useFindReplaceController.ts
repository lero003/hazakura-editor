import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { useFindMatchIndexSync } from "./useFindMatchIndexSync";
import { useFindReplaceActions } from "./useFindReplaceActions";
import { useFindReplaceState } from "./useFindReplaceState";

type UseFindReplaceControllerOptions = {
  documentKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  // Local Assist 生成ロック中は置換（1件・全件）を止める。検索は使える。
  replaceLocked?: boolean;
  setStatus: Dispatch<SetStateAction<string>>;
  source: string;
};

export function useFindReplaceController({
  documentKey,
  editorPaneRef,
  replaceLocked = false,
  setStatus,
  source,
}: UseFindReplaceControllerOptions) {
  const state = useFindReplaceState(source);
  const actions = useFindReplaceActions({
    activeMatchIndex: state.activeMatchIndex,
    editorPaneRef,
    findMatchCount: state.findMatchCount,
    replaceLocked,
    replaceQuery: state.replaceQuery,
    selectAfterReplacement: state.selectAfterReplacement,
    setActiveMatchIndex: state.setActiveMatchIndex,
    setFindQuery: state.setFindQuery,
    setFindVisible: state.setFindVisible,
    setReplaceQuery: state.setReplaceQuery,
    setStatus,
  });

  useFindMatchIndexSync({
    activeMatchIndex: state.activeMatchIndex,
    documentKey,
    findMatchCount: state.findMatchCount,
    findQuery: state.findQuery,
    searchOptions: state.searchOptions,
    setActiveMatchIndex: state.setActiveMatchIndex,
    suppressClamp: state.pendingSelectAfterReplace !== null,
  });

  return {
    ...state,
    ...actions,
  };
}
