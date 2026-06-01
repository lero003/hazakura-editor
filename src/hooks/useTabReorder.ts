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
  captured: boolean;
};

// Distance in CSS pixels the pointer must travel from the
// pointerdown position before a tab is treated as being dragged
// rather than clicked. 8 px forgives typical trackpad / WebView
// pointer jitter so a normal click never lands above the drag
// threshold, while still being responsive enough that deliberate
// drags cross it within a couple of frames.
const TAB_DRAG_ACTIVATE_DISTANCE_PX = 8;

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
    const dragState = pointerTabDragRef.current;
    if (
      dragState &&
      dragState.captured &&
      target instanceof Element
    ) {
      try {
        target.releasePointerCapture(dragState.pointerId);
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

      // Do NOT call setPointerCapture here. The previous
      // implementation captured on pointerdown, which in the Tauri
      // WKWebView can make the subsequent click event target the
      // captured <div> rather than the inner <button>, silently
      // swallowing the tab-select click. We only capture once the
      // drag actually activates, so a normal click is delivered to
      // the button untouched.
      pointerTabDragRef.current = {
        tabId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        captured: false,
      };
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
        if (distance < TAB_DRAG_ACTIVATE_DISTANCE_PX) {
          return;
        }

        // The pointer has moved far enough to be a real drag. Now
        // that we're committed, capture the pointer so the
        // pointermove stream keeps firing even if the pointer
        // leaves the original tab.
        if (!dragState.captured) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragState.captured = true;
          } catch {
            // Pointer capture is best-effort; document hit-testing
            // still works without it.
          }
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
