import { describe, expect, it } from "vitest";
import type { EditorTab } from "../../types";
import {
  captureChangeReviewSnapshot,
  getChangeReviewStaleReason,
  isStaleAwareScope,
} from "./changeReviewStale";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "hello",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fp",
    id: "/workspace/note.md",
    sessionId: "session:1",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "hello",
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

describe("isStaleAwareScope", () => {
  it("treats buffer-vs-disk and backup-vs-buffer as stale-aware", () => {
    expect(isStaleAwareScope("buffer-vs-disk")).toBe(true);
    expect(isStaleAwareScope("backup-vs-buffer")).toBe(true);
  });

  it("excludes fixed-snapshot scopes from stale detection", () => {
    expect(isStaleAwareScope("draft-vs-disk")).toBe(false);
    expect(isStaleAwareScope("ai-edit-vs-buffer")).toBe(false);
    expect(isStaleAwareScope("conflict-vs-disk")).toBe(false);
  });
});

describe("captureChangeReviewSnapshot", () => {
  it("captures the tab id, session id, buffer, and dirty state", () => {
    const snapshot = captureChangeReviewSnapshot(
      makeTab({ contents: "draft", sessionId: "session:7" }),
    );

    expect(snapshot.tabId).toBe("/workspace/note.md");
    expect(snapshot.sessionId).toBe("session:7");
    expect(snapshot.contents).toBe("draft");
    expect(snapshot.lineEnding).toBe("lf");
    expect(snapshot.encoding).toBe("utf-8");
    expect(snapshot.dirty).toBe(true);
  });

  it("marks a clean tab as not dirty", () => {
    const snapshot = captureChangeReviewSnapshot(makeTab());
    expect(snapshot.dirty).toBe(false);
  });
});

describe("getChangeReviewStaleReason", () => {
  const snapshot = captureChangeReviewSnapshot(makeTab());

  it("returns null when the current tab matches the snapshot", () => {
    expect(getChangeReviewStaleReason(snapshot, makeTab())).toBeNull();
  });

  it("returns tab-closed when the current tab is null", () => {
    expect(getChangeReviewStaleReason(snapshot, null)).toBe("tab-closed");
  });

  it("returns tab-switched when the session id differs", () => {
    expect(
      getChangeReviewStaleReason(snapshot, makeTab({ sessionId: "session:2" })),
    ).toBe("tab-switched");
  });

  it("returns tab-switched when the tab id (path) differs", () => {
    expect(
      getChangeReviewStaleReason(
        snapshot,
        makeTab({ id: "/workspace/other.md", path: "/workspace/other.md" }),
      ),
    ).toBe("tab-switched");
  });

  it("returns buffer-edited when the contents changed after capture", () => {
    expect(
      getChangeReviewStaleReason(snapshot, makeTab({ contents: "edited" })),
    ).toBe("buffer-edited");
  });

  it("returns buffer-edited when only the line ending changed", () => {
    expect(
      getChangeReviewStaleReason(snapshot, makeTab({ line_ending: "crlf" })),
    ).toBe("buffer-edited");
  });
});
