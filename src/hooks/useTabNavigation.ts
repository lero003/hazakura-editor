import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import type { EditorTab } from "../types";

type TabFocusDirection = "previous" | "next";

type UseTabNavigationOptions = {
  activeTabId: string | null;
  clearImagePreview: () => void;
  focusEditorSoon: () => void;
  imageReturnTabId: string | null;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setStatus: (message: string) => void;
  tabs: EditorTab[];
};

export function useTabNavigation({
  activeTabId,
  clearImagePreview,
  focusEditorSoon,
  imageReturnTabId,
  setActiveTabId,
  setStatus,
  tabs,
}: UseTabNavigationOptions) {
  const focusAdjacentTab = useCallback(
    (direction: TabFocusDirection) => {
      if (tabs.length < 2) {
        setStatus("No other tab to focus");
        return;
      }

      const currentTabId = activeTabId ?? imageReturnTabId ?? tabs[0]?.id;
      const currentIndex = tabs.findIndex((tab) => tab.id === currentTabId);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const offset = direction === "next" ? 1 : -1;
      const nextIndex = (safeIndex + offset + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];

      if (!nextTab) {
        return;
      }

      clearImagePreview();
      setActiveTabId(nextTab.id);
      setStatus(
        direction === "next" ? "Next tab focused" : "Previous tab focused",
      );
      focusEditorSoon();
    },
    [
      activeTabId,
      clearImagePreview,
      focusEditorSoon,
      imageReturnTabId,
      setActiveTabId,
      setStatus,
      tabs,
    ],
  );

  const selectTabFromBar = useCallback(
    (tabId: string) => {
      clearImagePreview();
      setActiveTabId(tabId);
    },
    [clearImagePreview, setActiveTabId],
  );

  return {
    focusAdjacentTab,
    selectTabFromBar,
  };
}
