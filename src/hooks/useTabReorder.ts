import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import type { EditorTab } from "../types";

type PointerTabDragState = {
  tabId: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

export function useTabReorder(
  setTabs: Dispatch<SetStateAction<EditorTab[]>>,
) {
  const pointerTabDragRef = useRef<PointerTabDragState | null>(null);
  const suppressNextTabClickRef = useRef(false);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const moveTabNearTarget = useCallback(
    (draggedId: string, targetTabId: string, insertAfterTarget: boolean) => {
      if (draggedId === targetTabId) {
        return;
      }

      setTabs((currentTabs) => {
        const draggedTab = currentTabs.find((tab) => tab.id === draggedId);
        if (!draggedTab || !currentTabs.some((tab) => tab.id === targetTabId)) {
          return currentTabs;
        }

        const withoutDragged = currentTabs.filter((tab) => tab.id !== draggedId);
        const targetIndex = withoutDragged.findIndex(
          (tab) => tab.id === targetTabId,
        );
        if (targetIndex < 0) {
          return currentTabs;
        }

        const insertIndex = targetIndex + (insertAfterTarget ? 1 : 0);
        const nextTabs = [...withoutDragged];
        nextTabs.splice(insertIndex, 0, draggedTab);

        return nextTabs;
      });
    },
    [setTabs],
  );

  const finishTabPointerDrag = useCallback((target?: EventTarget | null) => {
    if (target instanceof Element) {
      try {
        target.releasePointerCapture(
          pointerTabDragRef.current?.pointerId ?? -1,
        );
      } catch {
        // Pointer capture may already be released by the WebView.
      }
    }

    pointerTabDragRef.current = null;
    setDraggingTabId(null);
    setDragOverTabId(null);
  }, []);

  const handleTabPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, tabId: string) => {
      if (
        event.button !== 0 ||
        (event.target instanceof Element &&
          event.target.closest(".tab-close"))
      ) {
        return;
      }

      pointerTabDragRef.current = {
        tabId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; document hit-testing below still works.
      }
    },
    [],
  );

  const handleTabPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = pointerTabDragRef.current;
      if (!dragState) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY,
      );

      if (!dragState.dragging) {
        if (distance < 6) {
          return;
        }

        dragState.dragging = true;
        suppressNextTabClickRef.current = true;
        setDraggingTabId(dragState.tabId);
      }

      event.preventDefault();

      const targetElement = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-tab-id]");
      const targetTabId = targetElement?.dataset.tabId ?? null;
      setDragOverTabId(
        targetTabId && targetTabId !== dragState.tabId ? targetTabId : null,
      );

      if (!targetElement || !targetTabId || targetTabId === dragState.tabId) {
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      moveTabNearTarget(
        dragState.tabId,
        targetTabId,
        event.clientX > rect.left + rect.width / 2,
      );
    },
    [moveTabNearTarget],
  );

  const shouldSuppressTabClick = useCallback(() => {
    if (!suppressNextTabClickRef.current) {
      return false;
    }

    suppressNextTabClickRef.current = false;
    return true;
  }, []);

  return {
    draggingTabId,
    dragOverTabId,
    finishTabPointerDrag,
    handleTabPointerDown,
    handleTabPointerMove,
    shouldSuppressTabClick,
  };
}
