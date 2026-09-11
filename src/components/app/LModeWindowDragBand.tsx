import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toggleWindowZoom } from "../../features/workspace/windowZoom";

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
      // 通常モードの上部バーと同じく、ダブルクリックは最大化（フルスクリーンではない）。
      onDoubleClick={() => toggleWindowZoom()}
      onMouseDown={handleMouseDown}
    />
  );
}
