// `useEditorFindController` is the first domain-composer slice
// of the v0.9 `useAppShellController` split. It composes the
// existing find/replace controller and the go-to-line hook into
// a single typed surface, so the orchestrator can replace two
// adjacent call sites (19 find/replace fields + 4 go-to-line
// fields) with one. Both bundled hooks share the same two deps
// (`editorPaneRef` and the foundation's `setStatus`), and both
// operate on the active editor pane, so combining them is a
// real composition rather than a rename.
//
// The hook owns no new state of its own — it is a pure bundler.
// The 4-arg signature matches `useFindReplaceController`'s
// exactly, so the orchestrator's existing call-site args
// (`documentKey`, `editorPaneRef`, `setStatus`, `source:
// activeContents`) transfer directly. `useGoToLine` consumes the
// same two foundation-derived values. The wider
// `RefObject<EditorPaneHandle | null>` structurally satisfies
// `useGoToLine`'s narrower `RefObject<{ goToLine: (line: number)
// => void } | null>` because `EditorPaneHandle` declares
// `goToLine`.

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { useFindReplaceController } from "../find/useFindReplaceController";
import { useGoToLine } from "./useGoToLine";

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
  const findReplace = useFindReplaceController({
    documentKey,
    editorPaneRef,
    setStatus,
    source,
  });
  const goToLine = useGoToLine({
    editorPaneRef,
    onStatus: setStatus,
  });
  return {
    ...findReplace,
    ...goToLine,
  };
}
