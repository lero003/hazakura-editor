import type { TextFileDocument } from "../../lib/tauri";
import type { EditorTab } from "../../types";
import { normalizeTextLineEndings } from "../../lib/utils";

let untitledTabCounter = 0;
let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `session:${sessionCounter}`;
}

export function createEditorTab(file: TextFileDocument): EditorTab {
  const editorContents = normalizeTextLineEndings(file.contents, "lf");

  return {
    ...file,
    id: file.path,
    sessionId: nextSessionId(),
    contents: editorContents,
    lastSavedContents: editorContents,
    lastSavedLineEnding: file.line_ending,
    lastSavedEncoding: file.encoding,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
  };
}

export function createUntitledEditorTab(): EditorTab {
  untitledTabCounter += 1;

  return {
    id: `untitled:${untitledTabCounter}`,
    sessionId: nextSessionId(),
    path: "",
    name: "untitled.md",
    contents: "",
    lastSavedContents: "",
    line_ending: "lf",
    lastSavedLineEnding: "lf",
    encoding: "utf-8",
    lastSavedEncoding: "utf-8",
    size: 0,
    modified_ms: null,
    fingerprint: "",
    large_file_warning: false,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
  };
}

/**
 * Unsaved Import Assist draft tab. `lastSavedContents` stays empty so
 * the buffer is dirty until the user explicitly saves (edit-before-save).
 */
export function createUntitledImportDraftTab(
  name: string,
  contents: string,
): EditorTab {
  const tab = createUntitledEditorTab();
  const safeName = name.trim() || "import-draft.md";
  const normalized = normalizeTextLineEndings(contents, "lf");
  return {
    ...tab,
    name: safeName.endsWith(".md") ? safeName : `${safeName}.md`,
    contents: normalized,
  };
}

export function isDirty(tab: EditorTab): boolean {
  return (
    tab.contents !== tab.lastSavedContents ||
    tab.line_ending !== tab.lastSavedLineEnding ||
    tab.encoding !== tab.lastSavedEncoding
  );
}

// Replace the editor buffer for a review-driven revert/restore (backup
// restore or AI edit discard). Saved baselines (`lastSaved*`) stay
// untouched, so a restored buffer that differs from the last save is
// dirty and one that matches it is clean. `saveStatus` is reset to
// "idle" and any error is cleared; no silent disk write happens.
export function replaceTabBufferForReview(
  tab: EditorTab,
  contents: string,
): EditorTab {
  return { ...tab, contents, saveStatus: "idle", error: null };
}

/**
 * Tab list mutation helpers (Q-STR-1).
 *
 * Identity rules callers must respect:
 * - `id` / `path` (named files): rekey on rename / Save As path change
 * - `sessionId`: stable CodeMirror / Assist / view session across Save As
 *
 * Prefer these over ad-hoc `tabs.map(...)` so new mutators cannot silently
 * mix `id` and `sessionId` matching.
 */
export function updateTabsById(
  tabs: readonly EditorTab[],
  tabId: string,
  update: (tab: EditorTab) => EditorTab,
): EditorTab[] {
  return mapMatchingTabs(tabs, (tab) => tab.id === tabId, update);
}

export function updateTabsBySessionId(
  tabs: readonly EditorTab[],
  sessionId: string,
  update: (tab: EditorTab) => EditorTab,
): EditorTab[] {
  return mapMatchingTabs(tabs, (tab) => tab.sessionId === sessionId, update);
}

export function updateTabsByPath(
  tabs: readonly EditorTab[],
  path: string,
  update: (tab: EditorTab) => EditorTab,
): EditorTab[] {
  if (!path) {
    return tabs as EditorTab[];
  }
  return mapMatchingTabs(tabs, (tab) => tab.path === path, update);
}

/** Review / Assist / backup-style full buffer replace; baselines unchanged. */
export function replaceTabsBufferBySessionId(
  tabs: readonly EditorTab[],
  sessionId: string,
  contents: string,
): EditorTab[] {
  return updateTabsBySessionId(tabs, sessionId, (tab) =>
    replaceTabBufferForReview(tab, contents),
  );
}

export function replaceTabsBufferById(
  tabs: readonly EditorTab[],
  tabId: string,
  contents: string,
): EditorTab[] {
  return updateTabsById(tabs, tabId, (tab) =>
    replaceTabBufferForReview(tab, contents),
  );
}

export function replaceTabsBufferByPath(
  tabs: readonly EditorTab[],
  path: string,
  contents: string,
): EditorTab[] {
  return updateTabsByPath(tabs, path, (tab) =>
    replaceTabBufferForReview(tab, contents),
  );
}

/**
 * Live typing path: clear error, keep `saving` if a save is in flight so the
 * UI does not flash idle mid-write.
 */
export function applyLiveEditorContentsById(
  tabs: readonly EditorTab[],
  tabId: string,
  contents: string,
): EditorTab[] {
  return updateTabsById(tabs, tabId, (tab) => ({
    ...tab,
    contents,
    saveStatus: tab.saveStatus === "saving" ? "saving" : "idle",
    error: null,
  }));
}

function mapMatchingTabs(
  tabs: readonly EditorTab[],
  match: (tab: EditorTab) => boolean,
  update: (tab: EditorTab) => EditorTab,
): EditorTab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (!match(tab)) {
      return tab;
    }
    changed = true;
    return update(tab);
  });
  return changed ? next : (tabs as EditorTab[]);
}

export function getWorkspaceTabMarkerPaths(
  tabs: readonly EditorTab[],
  workspaceRootPath: string | null,
): { openFilePaths: string[]; dirtyFilePaths: string[] } {
  if (!workspaceRootPath) {
    return { openFilePaths: [], dirtyFilePaths: [] };
  }

  const root = workspaceRootPath.replace(/\/+$/, "");
  const openFilePaths = new Set<string>();
  const dirtyFilePaths = new Set<string>();

  for (const tab of tabs) {
    if (!tab.path || !isPathInWorkspace(tab.path, root)) {
      continue;
    }
    openFilePaths.add(tab.path);
    if (isDirty(tab)) {
      dirtyFilePaths.add(tab.path);
    }
  }

  return {
    dirtyFilePaths: [...dirtyFilePaths],
    openFilePaths: [...openFilePaths],
  };
}

function isPathInWorkspace(path: string, workspaceRootPath: string): boolean {
  return path === workspaceRootPath || path.startsWith(`${workspaceRootPath}/`);
}

export function isSaveFailureError(tab: EditorTab | null): boolean {
  return tab?.saveStatus === "error";
}
