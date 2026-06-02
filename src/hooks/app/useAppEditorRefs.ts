import { useRef } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import type { EditorTab } from "../../types";
import { useLatestValueRef } from "./useLatestValueRef";

export function useAppEditorRefs(tabs: EditorTab[]) {
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const editorPaneRef = useRef<EditorPaneHandle | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useLatestValueRef(tabs);

  return {
    editorPaneRef,
    findInputRef,
    previewPaneRef,
    tabsRef,
  };
}
