import type { Dispatch, SetStateAction } from "react";
import type {
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  RightPaneMode,
} from "../../types";
import { useSidePaneResize } from "./useSidePaneResize";
import { useSidePaneState } from "./useSidePaneState";
import { useSidePaneToggles } from "./useSidePaneToggles";

type UseSidePaneControllerOptions = {
  activeTab: EditorTab | null;
  compareView: CompareViewState | null;
  previewVisible: boolean;
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  sidePaneOpen: boolean;
};

export function useSidePaneController({
  activeTab,
  compareView,
  previewVisible,
  rightPaneMode,
  selectedImage,
  setPreviewVisible,
  setRightPaneMode,
  setSidePaneOpen,
  sidePaneOpen,
}: UseSidePaneControllerOptions) {
  const {
    hasWorkspaceSelection,
    sidePaneMode,
    sidePaneVisible,
  } = useSidePaneState({
    activeTab,
    compareView,
    previewVisible,
    rightPaneMode,
    selectedImage,
    sidePaneOpen,
  });
  const {
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    previewColumnPercent,
  } = useSidePaneResize({
    sidePaneMode,
    sidePaneVisible,
  });
  const {
    hideSidePane,
    toggleDiffPane,
    toggleEbookPane,
    toggleOutlinePane,
    togglePreviewPane,
  } = useSidePaneToggles({
    activeTab,
    setPreviewVisible,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneMode,
    sidePaneOpen,
  });

  return {
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    hasWorkspaceSelection,
    hideSidePane,
    previewColumnPercent,
    sidePaneMode,
    sidePaneVisible,
    toggleDiffPane,
    toggleEbookPane,
    toggleOutlinePane,
    togglePreviewPane,
  };
}
