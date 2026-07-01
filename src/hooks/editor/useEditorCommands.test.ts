import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorCommands } from "./useEditorCommands";
import type { EditorTab } from "../../types";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "saved",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/tmp/a.md",
    sessionId: "/tmp/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/tmp/a.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

function setup(activeTab: EditorTab) {
  const setTabs = vi.fn();
  const { result } = renderHook(() =>
    useEditorCommands({
      activeDraft: null,
      activeTab,
      activeTabId: activeTab.id,
      agentWorkbenchActive: false,
      editorPaneRef: { current: null },
      handleSendSelectionToAgent: vi.fn(),
      menuLanguage: "en",
      requestReviewDraftAgainstDisk: vi.fn(),
      requestReviewTabAgainstDisk: vi.fn(),
      setStatus: vi.fn(),
      setTabs,
    }),
  );

  return { result, setTabs };
}

describe("useEditorCommands", () => {
  it("keeps a saving tab in saving state when editor content changes", () => {
    const activeTab = makeTab({ saveStatus: "saving" });
    const { result, setTabs } = setup(activeTab);

    result.current.handleEditorChange("edited during save");

    const updateTabs = setTabs.mock.calls[0]?.[0];
    expect(typeof updateTabs).toBe("function");
    expect(updateTabs([activeTab])).toEqual([
      {
        ...activeTab,
        contents: "edited during save",
        error: null,
        saveStatus: "saving",
      },
    ]);
  });

  it("clears a previous non-saving error when editor content changes", () => {
    const activeTab = makeTab({
      error: "Save failed",
      saveStatus: "error",
    });
    const { result, setTabs } = setup(activeTab);

    result.current.handleEditorChange("edited after failure");

    const updateTabs = setTabs.mock.calls[0]?.[0];
    expect(typeof updateTabs).toBe("function");
    expect(updateTabs([activeTab])).toEqual([
      {
        ...activeTab,
        contents: "edited after failure",
        error: null,
        saveStatus: "idle",
      },
    ]);
  });
});
