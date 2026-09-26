import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUntitledEditorTab } from "../../features/editor/editorTabs";
import type { EditorSettings, EditorTab, RightPaneMode } from "../../types";
import { useLModeActions } from "./useLModeActions";

afterEach(cleanup);

const settings: EditorSettings = {
  wrapLines: true, showInvisibles: false, editorFontSize: 15,
  previewFontSize: 15, workspaceFontSize: 14, lModeFontSize: 18,
  tabSize: 2, spellcheckEnabled: true, autoBackupEnabled: true,
  ambientIntensity: "off", lModeEnabled: false, lModeTypewriter: false,
  appleAssistDiffInitiallyOpen: true, outsideImages: "ask",
  loadRemoteImages: false, materializeImagesOnExport: true,
};

function setup(activeTab: EditorTab | null = createUntitledEditorTab()) {
  const setStatus = vi.fn();
  const prepareReviewTabAgainstDisk = vi.fn(async () => null);
  const hook = renderHook(({ tab }) => {
    const [editorSettings, setEditorSettings] = useState(settings);
    const [sidePaneOpen, setSidePaneOpen] = useState(true);
    const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("compare");
    const actions = useLModeActions({
      activeTab: tab, editorSettings, prepareReviewTabAgainstDisk,
      referenceCompareActive: true, referenceRetainedStatus: "reference retained",
      rightPaneMode, setEditorSettings, setRightPaneMode, setSidePaneOpen,
      setStatus, sidePaneOpen,
    });
    return { ...actions, editorSettings, rightPaneMode, setRightPaneMode, sidePaneOpen, setSidePaneOpen };
  }, { initialProps: { tab: activeTab } });
  return { ...hook, setStatus, prepareReviewTabAgainstDisk };
}

describe("useLModeActions", () => {
  it("restores the side pane mode captured at entry without losing the reference", () => {
    const { result, setStatus } = setup();
    act(() => result.current.toggleLMode());
    expect(result.current.editorSettings.lModeEnabled).toBe(true);
    expect(result.current.sidePaneOpen).toBe(false);
    expect(setStatus).toHaveBeenCalledWith("reference retained");
    act(() => result.current.setRightPaneMode("preview"));
    act(() => result.current.exitLModeToWorkspace());
    expect(result.current.sidePaneOpen).toBe(true);
    expect(result.current.rightPaneMode).toBe("compare");
    expect(result.current.editorSettings).toEqual(settings);
  });

  it("takes a fresh pane snapshot on each entry", () => {
    const { result } = setup();
    act(() => result.current.toggleLMode());
    act(() => result.current.exitLModeToWorkspace());
    act(() => {
      result.current.setSidePaneOpen(false);
      result.current.setRightPaneMode("outline");
    });
    act(() => result.current.toggleLMode());
    act(() => result.current.exitLModeToWorkspace());
    expect(result.current.sidePaneOpen).toBe(false);
    expect(result.current.rightPaneMode).toBe("outline");
  });

  it("refuses a non-Markdown document without changing presentation settings", () => {
    const { result, setStatus } = setup({ ...createUntitledEditorTab(), name: "style.css" });
    act(() => result.current.toggleLMode());
    expect(result.current.editorSettings).toEqual(settings);
    expect(result.current.sidePaneOpen).toBe(true);
    expect(setStatus).toHaveBeenCalledWith("L Mode is for Markdown writing. Open a .md file to use L Mode.");
  });

  it("exits and restores the panes when switching to HTML", () => {
    const { result, rerender } = setup();
    act(() => result.current.toggleLMode());
    rerender({ tab: { ...createUntitledEditorTab(), name: "index.html" } });
    expect(result.current.editorSettings.lModeEnabled).toBe(false);
    expect(result.current.sidePaneOpen).toBe(true);
    expect(result.current.rightPaneMode).toBe("compare");
  });

  it("reviews the current tab only after an explicit request", async () => {
    const tab = createUntitledEditorTab();
    const { result, rerender, prepareReviewTabAgainstDisk } = setup(tab);
    act(() => result.current.toggleLMode());
    expect(prepareReviewTabAgainstDisk).not.toHaveBeenCalled();
    await act(async () => { await result.current.reviewChangesFromLMode(); });
    expect(prepareReviewTabAgainstDisk).toHaveBeenCalledExactlyOnceWith(tab);
    rerender({ tab: null });
    expect(await result.current.reviewChangesFromLMode()).toBeNull();
    expect(prepareReviewTabAgainstDisk).toHaveBeenCalledOnce();
  });
});
