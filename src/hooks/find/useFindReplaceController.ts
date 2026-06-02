import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/EditorPane";
import { useFindMatchIndexSync } from "./useFindMatchIndexSync";
import { useFindReplaceActions } from "./useFindReplaceActions";
import { useFindReplaceState } from "./useFindReplaceState";

type UseFindReplaceControllerOptions = {
  documentKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  setStatus: Dispatch<SetStateAction<string>>;
  source: string;
};

export function useFindReplaceController({
  documentKey,
  editorPaneRef,
  setStatus,
  source,
}: UseFindReplaceControllerOptions) {
  const state = useFindReplaceState(source);
  const actions = useFindReplaceActions({
    editorPaneRef,
    findMatchCount: state.findMatchCount,
    replaceQuery: state.replaceQuery,
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
  });

  return {
    ...state,
    ...actions,
  };
}
