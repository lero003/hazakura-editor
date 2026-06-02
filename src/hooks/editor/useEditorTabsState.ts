import { useState } from "react";
import type { EditorTab } from "../../types";

export function useEditorTabsState() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  return {
    activeTabId,
    setActiveTabId,
    setTabs,
    tabs,
  };
}
