import {
  DEFAULT_PREVIEW_COLUMN_PERCENT,
  MAX_PREVIEW_COLUMN_PERCENT,
  MIN_PREVIEW_COLUMN_PERCENT,
  WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
} from "../../types";
import { clampNumber } from "../../lib/utils";

export const DEFAULT_WORKSPACE_SIDEBAR_WIDTH = 280;
/* 実機指摘（第15報）: 200 ではワークスペースのヘッダー行（「WORKSPACE」の見出し＋
   新規/開く/ゴミ箱のアイコン）が必要とする幅（実測 約199px）にちょうど重なり、
   最小まで狭めると左側が数px 隠れていた。見出しの文字幅は言語とフォントで変わるため、
   余裕を見て 240 を下限にする（既定 280 / 上限 400 の範囲は変えない）。 */
export const MIN_WORKSPACE_SIDEBAR_WIDTH = 240;
// The app window can shrink to 960 px. Keeping the sidebar at or below 400 px
// leaves room for the existing 280 px editor + 260 px right-pane minima and
// both 6 px separators without horizontal overflow.
export const MAX_WORKSPACE_SIDEBAR_WIDTH = 400;
export const DEFAULT_REFERENCE_COLUMN_PERCENT = 42;
export const WORKSPACE_SIDEBAR_KEYBOARD_STEP = 16;

export type WorkspacePaneLayout = {
  previewColumnPercent: number;
  referenceColumnPercent: number;
  workspaceSidebarWidth: number;
};

const DEFAULT_WORKSPACE_PANE_LAYOUT: WorkspacePaneLayout = {
  previewColumnPercent: DEFAULT_PREVIEW_COLUMN_PERCENT,
  referenceColumnPercent: DEFAULT_REFERENCE_COLUMN_PERCENT,
  workspaceSidebarWidth: DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
};

export function readWorkspacePaneLayout(): WorkspacePaneLayout {
  let stored: unknown;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PANE_LAYOUT_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    return { ...DEFAULT_WORKSPACE_PANE_LAYOUT };
  }

  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_WORKSPACE_PANE_LAYOUT };
  }

  const candidate = stored as Partial<WorkspacePaneLayout>;
  return normalizeWorkspacePaneLayout(candidate);
}

export function updateStoredWorkspacePaneLayout(
  patch: Partial<WorkspacePaneLayout>,
): void {
  const next = normalizeWorkspacePaneLayout({
    ...readWorkspacePaneLayout(),
    ...patch,
  });

  try {
    window.localStorage.setItem(
      WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Layout persistence is best-effort. Editing remains available if the
    // webview storage area is unavailable or full.
  }
}

export function resizeWorkspaceSidebarWidth(
  workspaceLeft: number,
  clientX: number,
): number {
  return clampNumber(
    clientX - workspaceLeft,
    MIN_WORKSPACE_SIDEBAR_WIDTH,
    MAX_WORKSPACE_SIDEBAR_WIDTH,
    DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
  );
}

export function resizeRightPanePercent({
  clientX,
  left,
  right,
}: {
  clientX: number;
  left: number;
  right: number;
}): number {
  const width = right - left;
  if (width <= 0) {
    return DEFAULT_PREVIEW_COLUMN_PERCENT;
  }
  return clampNumber(
    ((right - clientX) / width) * 100,
    MIN_PREVIEW_COLUMN_PERCENT,
    MAX_PREVIEW_COLUMN_PERCENT,
    DEFAULT_PREVIEW_COLUMN_PERCENT,
  );
}

function normalizeWorkspacePaneLayout(
  candidate: Partial<WorkspacePaneLayout>,
): WorkspacePaneLayout {
  return {
    previewColumnPercent: clampNumber(
      candidate.previewColumnPercent,
      MIN_PREVIEW_COLUMN_PERCENT,
      MAX_PREVIEW_COLUMN_PERCENT,
      DEFAULT_PREVIEW_COLUMN_PERCENT,
    ),
    referenceColumnPercent: clampNumber(
      candidate.referenceColumnPercent,
      MIN_PREVIEW_COLUMN_PERCENT,
      MAX_PREVIEW_COLUMN_PERCENT,
      DEFAULT_REFERENCE_COLUMN_PERCENT,
    ),
    workspaceSidebarWidth: clampNumber(
      candidate.workspaceSidebarWidth,
      MIN_WORKSPACE_SIDEBAR_WIDTH,
      MAX_WORKSPACE_SIDEBAR_WIDTH,
      DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
    ),
  };
}
