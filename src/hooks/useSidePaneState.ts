import type {
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  RightPaneMode,
} from "../types";

type UseSidePaneStateOptions = {
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  compareView: CompareViewState | null;
  previewVisible: boolean;
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
};

export function useSidePaneState({
  activeTab,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  compareView,
  previewVisible,
  rightPaneMode,
  selectedImage,
}: UseSidePaneStateOptions) {
  const agentWorkbenchAvailable =
    agentWorkbenchActive && agentWorkbenchConsent;
  const effectiveRightPaneMode: RightPaneMode =
    agentWorkbenchAvailable && !activeTab && rightPaneMode === "preview"
      ? "agent"
      : rightPaneMode;
  const agentPaneVisible =
    agentWorkbenchAvailable && effectiveRightPaneMode === "agent";
  const outlinePaneVisible =
    effectiveRightPaneMode === "outline" && activeTab !== null;
  const previewPaneVisible =
    effectiveRightPaneMode === "preview" &&
    previewVisible &&
    activeTab !== null;
  const sidePaneMode: RightPaneMode | null =
    effectiveRightPaneMode === "compare"
      ? "compare"
      : agentPaneVisible
        ? "agent"
        : outlinePaneVisible
          ? "outline"
          : previewPaneVisible
            ? "preview"
            : null;
  const sidePaneVisible = sidePaneMode !== null;
  const hasWorkspaceSelection = Boolean(
    activeTab || selectedImage || compareView || agentPaneVisible,
  );

  return {
    agentPaneVisible,
    agentWorkbenchAvailable,
    effectiveRightPaneMode,
    hasWorkspaceSelection,
    outlinePaneVisible,
    previewPaneVisible,
    sidePaneMode,
    sidePaneVisible,
  };
}
