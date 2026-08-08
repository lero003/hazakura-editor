import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_PREVIEW_COLUMN_PERCENT,
  MAX_PREVIEW_COLUMN_PERCENT,
  MIN_PREVIEW_COLUMN_PERCENT,
  type RightPaneMode,
} from "../../types";
import { clampNumber } from "../../lib/utils";
import {
  readWorkspacePaneLayout,
  resizeRightPanePercent,
  updateStoredWorkspacePaneLayout,
} from "../../features/workspace/paneLayout";

type UseSidePaneResizeOptions = {
  sidePaneMode: RightPaneMode | null;
  sidePaneVisible: boolean;
};

export function useSidePaneResize({
  sidePaneMode,
  sidePaneVisible,
}: UseSidePaneResizeOptions) {
  const editorPreviewGridRef = useRef<HTMLDivElement | null>(null);
  const [previewColumnPercent, setPreviewColumnPercent] = useState(
    () => readWorkspacePaneLayout().previewColumnPercent,
  );

  useEffect(() => {
    updateStoredWorkspacePaneLayout({ previewColumnPercent });
  }, [previewColumnPercent]);

  const editorPreviewGridStyle = useMemo<CSSProperties | undefined>(
    () =>
      sidePaneVisible && sidePaneMode !== "compare"
        ? {
            gridTemplateColumns: `minmax(280px, ${100 - previewColumnPercent}%) 6px minmax(260px, ${previewColumnPercent}%)`,
          }
        : undefined,
    [previewColumnPercent, sidePaneMode, sidePaneVisible],
  );

  const resizePreviewColumn = useCallback((clientX: number) => {
    const grid = editorPreviewGridRef.current;

    if (!grid) {
      return;
    }

    const rect = grid.getBoundingClientRect();
    setPreviewColumnPercent(
      resizeRightPanePercent({
        clientX,
        left: rect.left,
        right: rect.right,
      }),
    );
  }, []);

  const handlePreviewResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      resizePreviewColumn(event.clientX);
    },
    [resizePreviewColumn],
  );

  const handlePreviewResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        return;
      }

      resizePreviewColumn(event.clientX);
    },
    [resizePreviewColumn],
  );

  const handlePreviewResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      setPreviewColumnPercent((currentPercent) =>
        clampNumber(
          currentPercent + (event.key === "ArrowLeft" ? 5 : -5),
          MIN_PREVIEW_COLUMN_PERCENT,
          MAX_PREVIEW_COLUMN_PERCENT,
          currentPercent,
        ),
      );
    },
    [],
  );

  return {
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    previewColumnPercent,
  };
}
