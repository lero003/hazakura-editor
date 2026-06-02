import type { TextFileDocument } from "../../lib/tauri";
import type { EditorTab } from "../../types";
import { normalizeTextLineEndings } from "../../lib/utils";

export function createEditorTab(file: TextFileDocument): EditorTab {
  const editorContents = normalizeTextLineEndings(file.contents, "lf");

  return {
    ...file,
    id: file.path,
    contents: editorContents,
    lastSavedContents: editorContents,
    lastSavedLineEnding: file.line_ending,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
  };
}

export function isDirty(tab: EditorTab): boolean {
  return (
    tab.contents !== tab.lastSavedContents ||
    tab.line_ending !== tab.lastSavedLineEnding
  );
}

export function isSaveFailureError(tab: EditorTab | null): boolean {
  return tab?.saveStatus === "error";
}
