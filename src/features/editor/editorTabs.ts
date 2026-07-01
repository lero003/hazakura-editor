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

export function isDirty(tab: EditorTab): boolean {
  return (
    tab.contents !== tab.lastSavedContents ||
    tab.line_ending !== tab.lastSavedLineEnding ||
    tab.encoding !== tab.lastSavedEncoding
  );
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
