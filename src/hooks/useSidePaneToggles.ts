import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { EditorTab, RightPaneMode } from "../types";

type UseSidePaneTogglesOptions = {
  activeTab: EditorTab | null;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  sidePaneMode: RightPaneMode | null;
};

export function useSidePaneToggles({
  activeTab,
  setPreviewVisible,
  setRightPaneMode,
  sidePaneMode,
}: UseSidePaneTogglesOptions) {
  const togglePreviewPane = useCallback(() => {
    if (sidePaneMode === "preview") {
      setPreviewVisible(false);
      return;
    }

    setRightPaneMode("preview");
    setPreviewVisible(true);
  }, [setPreviewVisible, setRightPaneMode, sidePaneMode]);

  const toggleDiffPane = useCallback(() => {
    if (sidePaneMode === "compare") {
      setRightPaneMode("preview");
      return;
    }

    setRightPaneMode("compare");
  }, [setRightPaneMode, sidePaneMode]);

  const toggleOutlinePane = useCallback(() => {
    if (!activeTab) {
      return;
    }

    if (sidePaneMode === "outline") {
      setRightPaneMode("preview");
      return;
    }

    setRightPaneMode("outline");
  }, [activeTab, setRightPaneMode, sidePaneMode]);

  const toggleAgentPane = useCallback(() => {
    if (sidePaneMode === "agent") {
      setRightPaneMode("preview");
      return;
    }

    setRightPaneMode("agent");
  }, [setRightPaneMode, sidePaneMode]);

  return {
    toggleAgentPane,
    toggleDiffPane,
    toggleOutlinePane,
    togglePreviewPane,
  };
}
