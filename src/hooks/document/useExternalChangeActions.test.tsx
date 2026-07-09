import { renderHook, act } from "@testing-library/react";
import {
  type Dispatch,
  type SetStateAction,
} from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExternalChangeActions } from "./useExternalChangeActions";
import { getFileMetadata } from "../../lib/tauri";
import type { EditorTab } from "../../types";

vi.mock("../../lib/tauri", () => ({
  getFileMetadata: vi.fn(),
  openTextFile: vi.fn(),
}));

function makeUntitledImportTab(): EditorTab {
  return {
    id: "untitled:1",
    sessionId: "session:1",
    path: "",
    name: "scan-import.md",
    contents: "# draft",
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

describe("useExternalChangeActions pathless import drafts", () => {
  beforeEach(() => {
    vi.mocked(getFileMetadata).mockReset();
  });

  it("does not mark pathless tabs as save-failed after import", async () => {
    const tabs = [makeUntitledImportTab()];
    const tabsRef = { current: tabs };
    const setTabs = vi.fn<Dispatch<SetStateAction<EditorTab[]>>>((value) => {
      tabsRef.current =
        typeof value === "function" ? value(tabsRef.current) : value;
    });
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useExternalChangeActions({
        setStatus,
        setTabs,
        tabsRef,
      }),
    );

    await act(async () => {
      await result.current.checkTabForExternalChange("untitled:1");
    });

    expect(getFileMetadata).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
    expect(tabsRef.current[0]?.saveStatus).toBe("idle");
    expect(tabsRef.current[0]?.error).toBeNull();
  });
});
