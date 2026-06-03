import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useState,
} from "react";
import type { TabContextMenuState } from "../../components/editor/TabContextMenu";

export function useTabContextMenu() {
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState | null>(
    null,
  );

  const openTabContextMenu = useCallback(
    (path: string, event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setTabContextMenu({ path, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  return {
    closeTabContextMenu,
    openTabContextMenu,
    tabContextMenu,
  };
}
