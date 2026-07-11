import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DRAFT_STATE_STORAGE_KEY,
  type DraftRecord,
  type EditorTab,
} from "../../types";
import { readStoredDrafts } from "../../lib/storage";
import { useDraftPersistence } from "./useDraftPersistence";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "saved-fingerprint",
    id: "/workspace/note.md",
    sessionId: "/workspace/note.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: 1,
    name: "note.md",
    path: "/workspace/note.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

function renderDraftPersistence({
  pendingDrafts = [],
  tabs,
}: {
  pendingDrafts?: DraftRecord[];
  tabs: EditorTab[];
}) {
  return renderHook(() =>
    useDraftPersistence({
      discardingWindowCloseRef: { current: false },
      pendingDrafts,
      restoreComplete: true,
      tabs,
    }),
  );
}

describe("useDraftPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("persists dirty pathless untitled tabs as recovery candidates", async () => {
    renderDraftPersistence({
      tabs: [
        makeTab({
          contents: "# Untitled draft",
          id: "untitled:1",
          sessionId: "session:pathless-1",
          lastSavedContents: "",
          name: "untitled.md",
          path: "",
          fingerprint: "",
        }),
      ],
    });

    await waitFor(() => {
      expect(readStoredDrafts()).toHaveLength(1);
    });

    expect(readStoredDrafts()[0]).toMatchObject({
      contents: "# Untitled draft",
      path: "",
      recoveryId: "session:pathless-1",
      name: "untitled.md",
      origin: "untitled",
    });
  });

  it("does not persist empty pathless buffers", async () => {
    renderDraftPersistence({
      tabs: [
        makeTab({
          contents: "",
          id: "untitled:1",
          sessionId: "session:empty",
          lastSavedContents: "",
          name: "untitled.md",
          path: "",
          fingerprint: "",
        }),
      ],
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_STATE_STORAGE_KEY)).toBeNull();
    });
  });

  it("keeps persisting dirty tabs that have a file path", async () => {
    renderDraftPersistence({
      tabs: [
        makeTab({
          contents: "changed",
          lastSavedContents: "saved",
          path: "/workspace/note.md",
        }),
      ],
    });

    await waitFor(() => {
      expect(readStoredDrafts()).toHaveLength(1);
    });

    expect(readStoredDrafts()[0]).toMatchObject({
      contents: "changed",
      path: "/workspace/note.md",
    });
  });
});
