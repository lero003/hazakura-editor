import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSidePaneState } from "./useSidePaneState";
import type { EditorTab } from "../../types";

function makeTab(): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/a.md",
    sessionId: "/workspace/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "disk",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/workspace/a.md",
    saveStatus: "idle",
    size: 5,
  };
}

describe("useSidePaneState", () => {
  it("reports the requested mode when the side pane is open", () => {
    const { result } = renderHook(() =>
      useSidePaneState({
        activeTab: makeTab(),
        compareView: null,
        previewVisible: true,
        referencePaneVisible: false,
        rightPaneMode: "preview",
        selectedImage: null,
        sidePaneOpen: true,
      }),
    );

    expect(result.current.sidePaneMode).toBe("preview");
    expect(result.current.sidePaneVisible).toBe(true);
  });

  it("does not treat the side pane as visible while Reference owns the column", () => {
    const { result } = renderHook(() =>
      useSidePaneState({
        activeTab: makeTab(),
        compareView: { caseKey: "k", additions: 1, removals: 1, lines: [] },
        previewVisible: true,
        referencePaneVisible: true,
        rightPaneMode: "compare",
        selectedImage: null,
        sidePaneOpen: true,
      }),
    );

    expect(result.current.sidePaneMode).toBeNull();
    expect(result.current.sidePaneVisible).toBe(false);
  });
});
