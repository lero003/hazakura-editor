import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent as ReactMouseEvent } from "react";

export function LModeWindowDragBand() {
  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    void getCurrentWindow().startDragging().catch(() => {});
  };

  return (
    <div
      aria-hidden="true"
      className="lmode-window-drag-band"
      data-tauri-drag-region="true"
      onMouseDown={handleMouseDown}
    />
  );
}
