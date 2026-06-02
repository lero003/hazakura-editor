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
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
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
  agentWorkbenchActive,
  agentWorkbenchConsent,
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
    agentPaneVisible,
    agentWorkbenchAvailable,
    hasWorkspaceSelection,
    sidePaneMode,
    sidePaneVisible,
  } = useSidePaneState({
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
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
    toggleAgentPane,
    toggleDiffPane,
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
    agentPaneVisible,
    agentWorkbenchAvailable,
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    hasWorkspaceSelection,
    previewColumnPercent,
    sidePaneMode,
    sidePaneVisible,
    toggleAgentPane,
    toggleDiffPane,
    toggleOutlinePane,
    togglePreviewPane,
  };
}
