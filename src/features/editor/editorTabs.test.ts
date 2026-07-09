import { describe, expect, it } from "vitest";
import type { EditorTab } from "../../types";
import {
  applyLiveEditorContentsById,
  createEditorTab,
  createUntitledImportDraftTab,
  isDirty,
  isSaveFailureError,
  replaceTabBufferForReview,
  replaceTabsBufferBySessionId,
  updateTabsById,
  updateTabsBySessionId,
} from "./editorTabs";

// Shared dirty logic is the contract that all dirty-aware
// surfaces (TabBar, auto-backup, status messages, save
// prompts) must agree on. v0.18 adds encoding to that
// contract so the UI does not lose the dirty dot when the
// user only changes encoding in the selector.

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "saved",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fp",
    id: "/workspace/note.md",
    sessionId: "/workspace/note.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "note.md",
    path: "/workspace/note.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

describe("isDirty", () => {
  it("returns false when contents, line ending, and encoding all match", () => {
    expect(isDirty(makeTab())).toBe(false);
  });

  it("returns true when contents differ from lastSavedContents", () => {
    expect(isDirty(makeTab({ contents: "draft" }))).toBe(true);
  });

  it("returns true when line ending differs from lastSavedLineEnding", () => {
    expect(
      isDirty(
        makeTab({
          line_ending: "crlf",
          lastSavedLineEnding: "lf",
        }),
      ),
    ).toBe(true);
  });

  it("returns true when only encoding differs from lastSavedEncoding", () => {
    expect(
      isDirty(
        makeTab({
          encoding: "shift-jis",
          lastSavedEncoding: "utf-8",
        }),
      ),
    ).toBe(true);
  });
});

describe("createUntitledImportDraftTab", () => {
  it("opens a dirty unsaved tab with import contents", () => {
    const tab = createUntitledImportDraftTab(
      "scan-import.md",
      "# Draft\n\nbody\n",
    );
    expect(tab.path).toBe("");
    expect(tab.name).toBe("scan-import.md");
    expect(tab.contents).toBe("# Draft\n\nbody\n");
    expect(tab.lastSavedContents).toBe("");
    expect(isDirty(tab)).toBe(true);
  });
});

describe("createEditorTab", () => {
  it("starts the tab in a clean state with the file's encoding and line ending", () => {
    const tab = createEditorTab({
      contents: "hello\n",
      encoding: "shift-jis",
      fingerprint: "fp",
      large_file_warning: false,
      line_ending: "crlf",
      modified_ms: 123,
      name: "note.md",
      path: "/workspace/note.md",
      size: 6,
    });

    expect(tab.contents).toBe("hello\n");
    expect(tab.encoding).toBe("shift-jis");
    expect(tab.line_ending).toBe("crlf");
    expect(tab.lastSavedContents).toBe("hello\n");
    expect(tab.lastSavedEncoding).toBe("shift-jis");
    expect(tab.lastSavedLineEnding).toBe("crlf");
    expect(isDirty(tab)).toBe(false);
  });

  it("assigns a sessionId independent of the path and increments it per tab", () => {
    const tabA = createEditorTab({
      contents: "a",
      encoding: "utf-8",
      fingerprint: "fp-a",
      large_file_warning: false,
      line_ending: "lf",
      modified_ms: 1,
      name: "a.md",
      path: "/workspace/a.md",
      size: 1,
    });
    const tabB = createEditorTab({
      contents: "b",
      encoding: "utf-8",
      fingerprint: "fp-b",
      large_file_warning: false,
      line_ending: "lf",
      modified_ms: 2,
      name: "b.md",
      path: "/workspace/b.md",
      size: 1,
    });

    expect(tabA.sessionId).toBeTruthy();
    expect(tabA.sessionId).not.toBe(tabA.path);
    expect(tabB.sessionId).not.toBe(tabA.sessionId);
    // id still follows the path so rename / move can keep id === path.
    expect(tabA.id).toBe("/workspace/a.md");
    expect(tabB.id).toBe("/workspace/b.md");
  });
});

describe("isSaveFailureError", () => {
  it("returns true only when the active tab is in the error save status", () => {
    expect(isSaveFailureError(makeTab({ saveStatus: "error" }))).toBe(true);
    expect(isSaveFailureError(makeTab({ saveStatus: "idle" }))).toBe(false);
    expect(isSaveFailureError(null)).toBe(false);
  });
});

describe("replaceTabBufferForReview", () => {
  it("keeps saved baselines intact and marks different restored contents dirty", () => {
    const tab = makeTab({ contents: "edited", saveStatus: "saving", error: "boom" });
    const replaced = replaceTabBufferForReview(tab, "restored backup");

    expect(replaced.contents).toBe("restored backup");
    expect(replaced.saveStatus).toBe("idle");
    expect(replaced.error).toBeNull();
    // Saved baselines are untouched so the restored buffer is dirty.
    expect(replaced.lastSavedContents).toBe("saved");
    expect(isDirty(replaced)).toBe(true);
  });

  it("stays clean when the restored contents equal the saved baseline", () => {
    const replaced = replaceTabBufferForReview(makeTab(), "saved");

    expect(replaced.contents).toBe("saved");
    expect(isDirty(replaced)).toBe(false);
  });
});

describe("tab list mutation helpers (Q-STR-1)", () => {
  const other = makeTab({
    id: "/workspace/other.md",
    path: "/workspace/other.md",
    sessionId: "session:other",
    contents: "other",
    lastSavedContents: "other",
  });

  it("updateTabsById only mutates the matching id", () => {
    const target = makeTab({ sessionId: "session:target" });
    const next = updateTabsById([target, other], target.id, (tab) => ({
      ...tab,
      contents: "typed",
    }));
    expect(next[0].contents).toBe("typed");
    expect(next[1]).toBe(other);
  });

  it("updateTabsBySessionId matches session, not path/id", () => {
    // After Save As, id/path can change while sessionId stays fixed.
    const target = makeTab({
      id: "/workspace/new-name.md",
      path: "/workspace/new-name.md",
      sessionId: "session:stable",
    });
    const next = updateTabsBySessionId(
      [target, other],
      "session:stable",
      (tab) => ({ ...tab, contents: "from-assist" }),
    );
    expect(next[0].contents).toBe("from-assist");
    expect(next[0].sessionId).toBe("session:stable");
    expect(next[1].contents).toBe("other");
  });

  it("replaceTabsBufferBySessionId uses review replace (idle + clear error)", () => {
    const target = makeTab({
      sessionId: "session:assist",
      contents: "after",
      saveStatus: "saving",
      error: "stale",
    });
    const next = replaceTabsBufferBySessionId(
      [target, other],
      "session:assist",
      "before",
    );
    expect(next[0].contents).toBe("before");
    expect(next[0].saveStatus).toBe("idle");
    expect(next[0].error).toBeNull();
    expect(next[0].lastSavedContents).toBe("saved");
    expect(next[1]).toBe(other);
  });

  it("applyLiveEditorContentsById preserves saving status", () => {
    const target = makeTab({ saveStatus: "saving", error: "x" });
    const next = applyLiveEditorContentsById([target], target.id, "live");
    expect(next[0].contents).toBe("live");
    expect(next[0].saveStatus).toBe("saving");
    expect(next[0].error).toBeNull();
  });

  it("returns the same array reference when no tab matches", () => {
    const tabs = [other];
    expect(updateTabsById(tabs, "missing", (t) => t)).toBe(tabs);
    expect(updateTabsBySessionId(tabs, "missing", (t) => t)).toBe(tabs);
  });
});
