// `useEditorSurfaceController` is the fourth domain-composer
// slice of the v0.9 `useAppShellController` split. It composes
// `useSidePaneController` (12 fields) and
// `useActiveDocumentSurface` (10 fields) into a single typed
// surface.
//
// The composition is real (not a rename) because
// `useActiveDocumentSurface` consumes `sidePaneMode` produced
// by `useSidePaneController` — folding the wiring into the new
// controller removes one cross-section handoff in the
// orchestrator. Both bundled hooks are available in the
// orchestrator at the side-pane position (no upstream deps
// other than the foundation + C-2's editor-tab state + the
// refs slice), so the new section slots into the same spot as
// the old side-pane block without reordering.
//
// The hook owns no new state of its own — it is a pure
// bundler. The 18-arg signature is the union of the two
// bundled signatures (deduplicating the 4 fields they share:
// `activeTab`, `compareView`, `selectedImage`, plus the
// side-pane mode that is now wired internally).

import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  EditorPaneHandle,
  EditorSelectionInfo,
} from "../../components/editor/EditorPane";
import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  MenuLanguage,
  RightPaneMode,
} from "../../types";
import { useSidePaneController } from "../editor/useSidePaneController";
import { useActiveDocumentSurface } from "./useActiveDocumentSurface";

type UseEditorSurfaceControllerOptions = {
  activeContents: string;
  activeDirty: boolean;
  activeTab: EditorTab | null;
  compareView: CompareViewState | null;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  hasActiveDocument: boolean;
  menuLanguage: MenuLanguage;
  noFileOpenText: string;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  previewVisible: boolean;
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
  selectionInfo: EditorSelectionInfo;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  sidePaneOpen: boolean;
};

export function useEditorSurfaceController({
  activeContents,
  activeDirty,
  activeTab,
  compareView,
  editorPaneRef,
  getCompareCaseByKey,
  hasActiveDocument,
  menuLanguage,
  noFileOpenText,
  previewPaneRef,
  previewVisible,
  rightPaneMode,
  selectedImage,
  selectionInfo,
  setPreviewVisible,
  setRightPaneMode,
  setSidePaneOpen,
  sidePaneOpen,
}: UseEditorSurfaceControllerOptions) {
  const sidePane = useSidePaneController({
    activeTab,
    compareView,
    previewVisible,
    rightPaneMode,
    selectedImage,
    setPreviewVisible,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneOpen,
  });
  const surface = useActiveDocumentSurface({
    activeContents,
    activeDirty,
    activeTab,
    compareView,
    editorPaneRef,
    getCompareCaseByKey,
    hasActiveDocument,
    menuLanguage,
    noFileOpenText,
    previewPaneRef,
    selectedImage,
    selectionInfo,
    sidePaneMode: sidePane.sidePaneMode,
  });
  return {
    ...sidePane,
    ...surface,
  };
}
