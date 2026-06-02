import { useState } from "react";
import type { EditorSelectionInfo } from "../../components/EditorPane";

export function useEditorSelectionState() {
  const [selectionInfo, setSelectionInfo] = useState<EditorSelectionInfo>({
    line: 1,
    column: 1,
    selectedCharacters: 0,
    selectedLines: 0,
  });

  return {
    selectionInfo,
    setSelectionInfo,
  };
}
