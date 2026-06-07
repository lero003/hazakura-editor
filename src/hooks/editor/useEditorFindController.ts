// `useEditorFindController` is the first domain-composer slice
// of the v0.9 `useAppShellController` split. It exposes the
// existing find/replace controller under a single typed surface,
// so the orchestrator can replace one adjacent call site with
// one. The hook owns no new state of its own — it is a pure
// bundler.
//
// The 4-arg signature matches `useFindReplaceController`'s
// exactly, so the orchestrator's existing call-site args
// (`documentKey`, `editorPaneRef`, `setStatus`, `source:
// activeContents`) transfer directly.
//
// v0.16: `useGoToLine` was removed because the "go to line"
// input conflicted with the keyword-search focus of the find
// panel. The UI was deleted; the function was reached only
// through that UI, so the feature was dropped from the
// controller.

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { useFindReplaceController } from "../find/useFindReplaceController";

type UseEditorFindControllerOptions = {
  documentKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  setStatus: Dispatch<SetStateAction<string>>;
  source: string;
};

export function useEditorFindController({
  documentKey,
  editorPaneRef,
  setStatus,
  source,
}: UseEditorFindControllerOptions) {
  return useFindReplaceController({
    documentKey,
    editorPaneRef,
    setStatus,
    source,
  });
}
