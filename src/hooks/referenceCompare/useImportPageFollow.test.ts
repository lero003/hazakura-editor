import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useImportPageFollow } from "./useImportPageFollow";
import type { EditorTab } from "../../types";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";

function makeTab(sessionId: string): EditorTab {
  return {
    id: "tab",
    sessionId,
    path: "",
    name: "import.md",
    contents: "",
    lastSavedContents: "",
    lastSavedLineEnding: "lf",
    lastSavedEncoding: "utf-8",
    line_ending: "lf",
    encoding: "utf-8",
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

const draft = `<!-- hazakura:import-page index=0 -->

a

<!-- hazakura:import-page index=1 -->

b
`;

describe("useImportPageFollow", () => {
  it("sets PDF page from cursor when following a linked import draft", () => {
    const setPdfPageIndex = vi.fn();
    const setReferenceFollowMode = vi.fn();
    const referenceCompare: ReferenceCompareState = {
      reference: {
        kind: "pdf",
        path: "/ws/a.pdf",
        name: "a.pdf",
        pageCount: 2,
        referenceId: "ref-1",
      },
      origin: "import-assist",
      linkedEditorSessionId: "sess-import",
      followMode: "following",
      sourceFingerprint: "fp",
      externalChangePending: false,
    };

    renderHook(() =>
      useImportPageFollow({
        activeContents: draft,
        activeTab: makeTab("sess-import"),
        cursorLine: 5,
        referenceCompare,
        setPdfPageIndex,
        setReferenceFollowMode,
      }),
    );

    expect(setPdfPageIndex).toHaveBeenCalledWith(1);
    expect(setReferenceFollowMode).not.toHaveBeenCalled();
  });

  it("turns follow off when markers are deleted", () => {
    const setPdfPageIndex = vi.fn();
    const setReferenceFollowMode = vi.fn();
    const referenceCompare: ReferenceCompareState = {
      reference: {
        kind: "pdf",
        path: "/ws/a.pdf",
        name: "a.pdf",
        pageCount: 2,
        referenceId: "ref-1",
      },
      origin: "import-assist",
      linkedEditorSessionId: "sess-import",
      followMode: "following",
      sourceFingerprint: "fp",
      externalChangePending: false,
    };

    renderHook(() =>
      useImportPageFollow({
        activeContents: "no markers left",
        activeTab: makeTab("sess-import"),
        cursorLine: 1,
        referenceCompare,
        setPdfPageIndex,
        setReferenceFollowMode,
      }),
    );

    expect(setReferenceFollowMode).toHaveBeenCalledWith("off");
    expect(setPdfPageIndex).not.toHaveBeenCalled();
  });

  it("ignores cursor when a different tab is active", () => {
    const setPdfPageIndex = vi.fn();
    const referenceCompare: ReferenceCompareState = {
      reference: {
        kind: "pdf",
        path: "/ws/a.pdf",
        name: "a.pdf",
        pageCount: 2,
        referenceId: "ref-1",
      },
      origin: "import-assist",
      linkedEditorSessionId: "sess-import",
      followMode: "following",
      sourceFingerprint: "fp",
      externalChangePending: false,
    };

    renderHook(() =>
      useImportPageFollow({
        activeContents: draft,
        activeTab: makeTab("other-session"),
        cursorLine: 5,
        referenceCompare,
        setPdfPageIndex,
        setReferenceFollowMode: vi.fn(),
      }),
    );

    expect(setPdfPageIndex).not.toHaveBeenCalled();
  });
});
