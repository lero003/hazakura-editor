import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { EditorTab, RightPaneMode } from "../../types";

type UseSidePaneTogglesOptions = {
  activeTab: EditorTab | null;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  sidePaneMode: RightPaneMode | null;
  sidePaneOpen: boolean;
};

export function useSidePaneToggles({
  activeTab,
  setPreviewVisible,
  setRightPaneMode,
  setSidePaneOpen,
  sidePaneMode,
  sidePaneOpen,
}: UseSidePaneTogglesOptions) {
  const togglePreviewPane = useCallback(() => {
    if (sidePaneOpen && sidePaneMode === "preview") {
      setSidePaneOpen(false);
      return;
    }
    setRightPaneMode("preview");
    setPreviewVisible(true);
    setSidePaneOpen(true);
  }, [
    setPreviewVisible,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneMode,
    sidePaneOpen,
  ]);

  const toggleDiffPane = useCallback(() => {
    if (sidePaneOpen && sidePaneMode === "compare") {
      setSidePaneOpen(false);
      return;
    }
    setRightPaneMode("compare");
    setSidePaneOpen(true);
  }, [setRightPaneMode, setSidePaneOpen, sidePaneMode, sidePaneOpen]);

  const toggleOutlinePane = useCallback(() => {
    if (!activeTab) {
      return;
    }
    if (sidePaneOpen && sidePaneMode === "outline") {
      setSidePaneOpen(false);
      return;
    }
    setRightPaneMode("outline");
    setSidePaneOpen(true);
  }, [activeTab, setRightPaneMode, setSidePaneOpen, sidePaneMode, sidePaneOpen]);

  const toggleEbookPane = useCallback(() => {
    if (!activeTab) {
      return;
    }
    if (sidePaneOpen && sidePaneMode === "ebook") {
      setSidePaneOpen(false);
      return;
    }
    setRightPaneMode("ebook");
    setPreviewVisible(true);
    setSidePaneOpen(true);
  }, [activeTab, setPreviewVisible, setRightPaneMode, setSidePaneOpen, sidePaneMode, sidePaneOpen]);

  const hideSidePane = useCallback(() => {
    setSidePaneOpen(false);
  }, [setSidePaneOpen]);

  return {
    hideSidePane,
    toggleDiffPane,
    toggleEbookPane,
    toggleOutlinePane,
    togglePreviewPane,
  };
}
