import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabCloseFlow } from "./useTabCloseFlow";
import type { DraftRecord, EditorTab } from "../../types";

const tauriWindow = vi.hoisted(() => ({
  // v0.17 slice 1.4: the close flow now picks between
  // `hideMainWindow` (window-close path) and `exitApp`
  // (app-exit path). Both are imported from
  // `../../lib/tauri/window`, so the mock below targets
  // that module instead of the legacy `../../lib/tauri`
  // barrel.
  exitApp: vi.fn(async () => {}),
  hideMainWindow: vi.fn(async () => {}),
}));

const storage = vi.hoisted(() => ({
  draftRecordFromTab: vi.fn(),
  readStoredDrafts: vi.fn(() => []),
  removeStoredDrafts: vi.fn(),
  upsertDraftRecord: vi.fn(
    (records: DraftRecord[], draft: DraftRecord) => [...records, draft],
  ),
  writeStoredDrafts: vi.fn(),
}));

vi.mock("../../lib/tauri/window", () => ({
  exitApp: tauriWindow.exitApp,
  hideMainWindow: tauriWindow.hideMainWindow,
}));

vi.mock("../../lib/storage", () => ({
  draftRecordFromTab: storage.draftRecordFromTab,
  readStoredDrafts: storage.readStoredDrafts,
  removeStoredDrafts: storage.removeStoredDrafts,
  upsertDraftRecord: storage.upsertDraftRecord,
  writeStoredDrafts: storage.writeStoredDrafts,
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "saved-fingerprint",
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

function setup(overrides: Partial<Parameters<typeof useTabCloseFlow>[0]> = {}) {
  const dirtyTab = makeTab();
  const defaultTabsRef = overrides.tabsRef ?? { current: [dirtyTab] };
  const defaultSaveTabById = vi.fn(async (tabId: string) => {
    defaultTabsRef.current = defaultTabsRef.current.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            lastSavedContents: tab.contents,
            lastSavedEncoding: tab.encoding,
            lastSavedLineEnding: tab.line_ending,
            saveStatus: "saved",
          }
        : tab,
    );
    return true;
  });
  const options: Parameters<typeof useTabCloseFlow>[0] = {
    activeTabId: dirtyTab.id,
    allowWindowCloseRef: { current: false },
    dirtyTabs: [dirtyTab],
    discardingWindowCloseRef: { current: false },
    focusEditorSoon: vi.fn(),
    pendingCloseTabId: null,
    saveTabById: defaultSaveTabById,
    setActiveTabId: vi.fn(),
    setGlobalError: vi.fn(),
    setPendingAppClose: vi.fn(),
    setPendingCloseTabId: vi.fn(),
    setPendingDrafts: vi.fn(),
    setStatus: vi.fn(),
    setTabs: vi.fn(),
    tabs: [dirtyTab],
    tabsRef: defaultTabsRef,
    ...overrides,
  };

  return {
    dirtyTab,
    options,
    result: renderHook(() => useTabCloseFlow(options)).result,
  };
}

describe("useTabCloseFlow", () => {
  beforeEach(() => {
    tauriWindow.hideMainWindow.mockClear();
    tauriWindow.exitApp.mockClear();
    storage.draftRecordFromTab.mockClear();
    storage.readStoredDrafts.mockClear();
    storage.removeStoredDrafts.mockClear();
    storage.upsertDraftRecord.mockClear();
    storage.writeStoredDrafts.mockClear();
  });

  it("clears the app-close dialog state after saving all dirty tabs", async () => {
    const allowWindowCloseRef = { current: false };
    const onBeforeWindowClose = vi.fn();
    const setPendingAppClose = vi.fn();
    const { result } = setup({
      allowWindowCloseRef,
      onBeforeWindowClose,
      setPendingAppClose,
    });

    await act(async () => {
      await result.current.saveAllAndCloseWindow();
    });

    expect(setPendingAppClose).toHaveBeenCalledWith(false);
    expect(onBeforeWindowClose).toHaveBeenCalledTimes(1);
    expect(onBeforeWindowClose.mock.invocationCallOrder[0]).toBeLessThan(
      tauriWindow.hideMainWindow.mock.invocationCallOrder[0],
    );
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(allowWindowCloseRef.current).toBe(false);
  });

  it("clears the app-close dialog and resets dirty buffers after discarding all tabs", async () => {
    const allowWindowCloseRef = { current: false };
    const discardingWindowCloseRef = { current: false };
    const onBeforeWindowClose = vi.fn();
    const setPendingAppClose = vi.fn();
    const setTabs = vi.fn();
    const dirtyTab = makeTab({
      contents: "unsaved",
      error: "Save failed",
      lastSavedContents: "saved on disk",
      saveStatus: "error",
    });
    const { result } = setup({
      allowWindowCloseRef,
      dirtyTabs: [dirtyTab],
      discardingWindowCloseRef,
      onBeforeWindowClose,
      setPendingAppClose,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    await act(async () => {
      await result.current.discardAllAndCloseWindow();
    });

    expect(setPendingAppClose).toHaveBeenCalledWith(false);
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(setTabs.mock.invocationCallOrder[0]).toBeLessThan(
      tauriWindow.hideMainWindow.mock.invocationCallOrder[0],
    );
    expect(onBeforeWindowClose).toHaveBeenCalledTimes(1);
    expect(setTabs.mock.invocationCallOrder[0]).toBeLessThan(
      onBeforeWindowClose.mock.invocationCallOrder[0],
    );
    expect(onBeforeWindowClose.mock.invocationCallOrder[0]).toBeLessThan(
      tauriWindow.hideMainWindow.mock.invocationCallOrder[0],
    );
    expect(allowWindowCloseRef.current).toBe(false);
    expect(discardingWindowCloseRef.current).toBe(false);

    const resetTabs = setTabs.mock.calls[0]?.[0];
    expect(typeof resetTabs).toBe("function");
    expect(resetTabs([dirtyTab])).toEqual([
      {
        ...dirtyTab,
        contents: "saved on disk",
        encoding: dirtyTab.lastSavedEncoding,
        error: null,
        ignoredExternalFingerprint: null,
        line_ending: dirtyTab.lastSavedLineEnding,
        saveStatus: "idle",
      },
    ]);
  });

  it("removes stored drafts when a dirty tab is discarded and closed", () => {
    const pendingDrafts: DraftRecord[] = [
      {
        contents: "draft",
        line_ending: "lf",
        path: "/tmp/a.md",
        savedFingerprint: "saved-fingerprint",
        updatedAt: 1,
      },
      {
        contents: "other draft",
        line_ending: "lf",
        path: "/tmp/other.md",
        savedFingerprint: "other-fingerprint",
        updatedAt: 2,
      },
    ];
    const setPendingDrafts = vi.fn((next) => {
      if (typeof next === "function") {
        next(pendingDrafts);
      }
    });
    const dirtyTab = makeTab();
    const setTabs = vi.fn((next) => {
      if (typeof next === "function") {
        next([dirtyTab]);
      }
    });
    const { result } = setup({
      dirtyTabs: [dirtyTab],
      setPendingDrafts,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    act(() => {
      result.current.closeTabNow(dirtyTab.id);
    });

    expect(storage.removeStoredDrafts).toHaveBeenCalledWith([dirtyTab.path]);
    expect(setPendingDrafts).toHaveBeenCalledTimes(1);

    const filterDrafts = setPendingDrafts.mock.calls[0]?.[0];
    expect(typeof filterDrafts).toBe("function");
    expect(filterDrafts(pendingDrafts)).toEqual([pendingDrafts[1]]);
  });

  // v0.17 app-store-quality: save-restore-regression slice 1.3
  // — dirty tab close / app close recovery. The window-close
  // path is already pinned by
  // `useWindowCloseConfirmation.test.tsx`. The single-tab
  // close path is owned by this hook: `requestCloseTab`
  // decides between the dirty confirmation dialog and an
  // immediate `closeTabNow`, and `saveAndClosePendingTab`
  // is the only handler that turns the user's "Save"
  // choice into a tab removal. The tests below pin the
  // contracts that data-loss prevention actually depends
  // on at this layer:
  //   - a dirty tab close request must open the dialog
  //     state, never `closeTabNow`,
  //   - a clean tab close must not surface a dialog,
  //   - a stale / unknown tabId must be a no-op,
  //   - a failed save inside the "Save" branch must abort
  //     the close and return the user to the editor.

  it("opens the dirty confirmation dialog for a dirty tab and does not close", () => {
    // The most critical data-loss-prevention contract
    // at this layer: `requestCloseTab` for a dirty tab
    // must surface the dirty dialog and must NOT call
    // `closeTabNow`. A silent dirty-drop here would
    // discard the user's edits on the X-button path
    // without any UI confirmation.
    const dirtyTab = makeTab();
    const setPendingCloseTabId = vi.fn();
    const setTabs = vi.fn();
    const { result } = setup({
      dirtyTabs: [dirtyTab],
      setPendingCloseTabId,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    act(() => {
      result.current.requestCloseTab(dirtyTab.id);
    });

    expect(setPendingCloseTabId).toHaveBeenCalledTimes(1);
    expect(setPendingCloseTabId).toHaveBeenCalledWith(dirtyTab.id);
    // No tab removal may run — the dialog owns the
    // decision from here.
    expect(setTabs).not.toHaveBeenCalled();
  });

  it("closes a clean tab immediately without surfacing the dialog", () => {
    // The inverse contract: a clean tab has no unsaved
    // edits (`isDirty` is false), so the X-button path
    // must close it directly. Surfacing a dialog here
    // would block the everyday "close this tab" flow
    // for every clean close and tempt users to pick
    // Discard just to dismiss it.
    const cleanTab = makeTab({
      contents: "saved",
      lastSavedContents: "saved",
    });
    const setPendingCloseTabId = vi.fn();
    const setTabs = vi.fn();
    const { result } = setup({
      dirtyTabs: [],
      setPendingCloseTabId,
      setTabs,
      tabs: [cleanTab],
      tabsRef: { current: [cleanTab] },
    });

    act(() => {
      result.current.requestCloseTab(cleanTab.id);
    });

    // The dialog is opened only by passing the tab id;
    // `closeTabNow` may also call
    // `setPendingCloseTabId(null)` as a cleanup at the
    // end of its run, so the contract is "the dialog
    // was not opened for this tab" — not "the setter
    // was never called".
    expect(setPendingCloseTabId).not.toHaveBeenCalledWith(cleanTab.id);
    // `closeTabNow` is the only path that removes the
    // tab from `tabs`; its observable effect is
    // `setTabs` being called.
    expect(setTabs).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an unknown tab id", () => {
    // Defensive: a stale tabId (e.g. the tab was already
    // closed by another path) must not silently open
    // the dialog or trigger `closeTabNow`. The function
    // returns before either branch.
    const dirtyTab = makeTab();
    const setPendingCloseTabId = vi.fn();
    const setTabs = vi.fn();
    const { result } = setup({
      dirtyTabs: [dirtyTab],
      setPendingCloseTabId,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    act(() => {
      result.current.requestCloseTab("/tmp/missing-tab.md");
    });

    expect(setPendingCloseTabId).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
  });

  it("aborts the close and reactivates the tab when saveAndClosePendingTab cannot save the tab", async () => {
    // The "Save" branch in the dirty tab close dialog
    // calls `saveAndClosePendingTab`. If `saveTabById`
    // returns false (Save Conflict, write failure,
    // permission lost), the close MUST abort — the tab
    // stays open, the user is returned to the editor
    // for that tab so they can resolve the failure,
    // and the pending close is cleared so the dialog
    // can be re-opened cleanly on the next X-button
    // click. Otherwise the user would think the file
    // is saved and close the tab, losing the edits.
    const dirtyTab = makeTab();
    const setActiveTabId = vi.fn();
    const setPendingCloseTabId = vi.fn();
    const saveTabById = vi.fn(async () => false);
    const setTabs = vi.fn();
    const focusEditorSoon = vi.fn();
    const { result } = setup({
      dirtyTabs: [dirtyTab],
      focusEditorSoon,
      pendingCloseTabId: dirtyTab.id,
      saveTabById,
      setActiveTabId,
      setPendingCloseTabId,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    await act(async () => {
      await result.current.saveAndClosePendingTab();
    });

    expect(saveTabById).toHaveBeenCalledWith(dirtyTab.id);
    // No tab removal — `closeTabNow` must not run on
    // the save-failure branch.
    expect(setTabs).not.toHaveBeenCalled();
    // Editor focus must return to the pending tab so
    // the user can react to the save error surfaced
    // on the tab itself.
    expect(setActiveTabId).toHaveBeenCalledWith(dirtyTab.id);
    // The pending close is cleared so the dialog
    // state is not left dangling. The next X-button
    // click opens a fresh dialog.
    expect(setPendingCloseTabId).toHaveBeenCalledWith(null);
    expect(focusEditorSoon).toHaveBeenCalledTimes(1);
  });

  // v0.17 app-store-quality: save-restore-regression slice 1.4
  // — `Cmd+Q` / Quit menu dirty guard. The dialog is
  // shared between the window-close (red button) and
  // app-exit (Cmd+Q) paths; the `appExitInProgressRef`
  // tells `saveAllAndCloseWindow` /
  // `discardAllAndCloseWindow` which final action to
  // take. The tests below pin the four contracts that
  // data-loss prevention depends on at this layer:
  //   - Save All routes to `exitApp` when the dialog
  //     was opened by an app-exit request,
  //   - the ref is reset after the save loop, so a
  //     later red-button click on the same window does
  //     not silently exit,
  //   - Discard All mirrors the same two contracts.

  it("routes Save All through exitApp when the dialog was opened for app exit", async () => {
    const dirtyTab = makeTab();
    const appExitInProgressRef = { current: true };
    const { result } = setup({
      appExitInProgressRef,
      dirtyTabs: [dirtyTab],
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    await act(async () => {
      await result.current.saveAllAndCloseWindow();
    });

    expect(tauriWindow.exitApp).toHaveBeenCalledTimes(1);
    // The window-close path must NOT fire on the
    // app-exit path — calling `hideMainWindow` would
    // hide the window without exiting, leaving the
    // user to re-trigger the quit manually.
    expect(tauriWindow.hideMainWindow).not.toHaveBeenCalled();
    // The ref is reset so a subsequent red-button
    // close on the now-hidden-to-be-quit window does
    // not re-enter the exit path.
    expect(appExitInProgressRef.current).toBe(false);
  });

  it("stops Save All when a tab becomes dirty again during the save loop", async () => {
    const dirtyTab = makeTab({ contents: "first edit" });
    const redirtiedTab = {
      ...dirtyTab,
      contents: "second edit during save",
      lastSavedContents: "first edit",
    };
    const tabsRef = { current: [dirtyTab] };
    const appExitInProgressRef = { current: true };
    const setActiveTabId = vi.fn();
    const setPendingAppClose = vi.fn();
    const setStatus = vi.fn();
    const focusEditorSoon = vi.fn();
    const saveTabById = vi.fn(async () => {
      tabsRef.current = [redirtiedTab];
      return true;
    });
    const { result } = setup({
      appExitInProgressRef,
      dirtyTabs: [dirtyTab],
      focusEditorSoon,
      saveTabById,
      setActiveTabId,
      setPendingAppClose,
      setStatus,
      tabs: [dirtyTab],
      tabsRef,
    });

    await act(async () => {
      await result.current.saveAllAndCloseWindow();
    });

    expect(saveTabById).toHaveBeenCalledWith(dirtyTab.id);
    expect(tauriWindow.exitApp).not.toHaveBeenCalled();
    expect(tauriWindow.hideMainWindow).not.toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith(dirtyTab.id);
    expect(setPendingAppClose).toHaveBeenCalledWith(false);
    expect(setStatus).toHaveBeenCalledWith("Close stopped");
    expect(focusEditorSoon).toHaveBeenCalledTimes(1);
    expect(appExitInProgressRef.current).toBe(false);
  });

  it("routes Discard All through exitApp when the dialog was opened for app exit", async () => {
    const dirtyTab = makeTab();
    const appExitInProgressRef = { current: true };
    const setTabs = vi.fn();
    const { result } = setup({
      appExitInProgressRef,
      dirtyTabs: [dirtyTab],
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    await act(async () => {
      await result.current.discardAllAndCloseWindow();
    });

    expect(tauriWindow.exitApp).toHaveBeenCalledTimes(1);
    expect(tauriWindow.hideMainWindow).not.toHaveBeenCalled();
    // The discarded-tab reset still runs (the buffers
    // must be reverted to lastSaved* before exit).
    expect(setTabs).toHaveBeenCalled();
    expect(appExitInProgressRef.current).toBe(false);
  });
});
