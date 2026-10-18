import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecoveryMessages } from "../../components/app/RecoveryMessages";
import { StatusBar } from "../../components/app/StatusBar";
import { createEditorTab, updateTabsById } from "../../features/editor/editorTabs";
import { getEditorChromeCopy } from "../../lib/locale/editorChrome";
import { getRecoveryCopy } from "../../lib/locale/recovery";
import type { TextFileDocument } from "../../lib/tauri/files";
import type { DraftRecord, EditorTab } from "../../types";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useEditorTabState } from "../editor/useEditorTabState";
import { useRecoveryActions } from "./useRecoveryActions";

const files = vi.hoisted(() => ({ openTextFile: vi.fn() }));
vi.mock("../../lib/tauri/files", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/tauri/files")>(),
  openTextFile: files.openTextFile,
}));

const noop = () => {};
const chromeCopy = getEditorChromeCopy("ja");
const recoveryCopy = getRecoveryCopy("ja");
const diskFile: TextFileDocument = {
  path: "/workspace/note.md",
  name: "note.md",
  contents: "日本語の原稿\n",
  encoding: "utf-8",
  line_ending: "lf",
  size: 22,
  modified_ms: 123,
  fingerprint: "original-disk-version",
  large_file_warning: false,
};

function EncodingFlow() {
  const [tabs, setTabs] = useState<EditorTab[]>(() => [createEditorTab(diskFile)]);
  const [activeTabId, setActiveTabId] = useState<string | null>(diskFile.path);
  const [pendingDrafts, setPendingDrafts] = useState<DraftRecord[]>([]);
  const [status, setStatus] = useState("Ready");
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const state = useEditorTabState({
    activeTabId, globalError: null, pendingCloseTabId: null,
    pendingDrafts, menuLanguage: "ja", tabs,
  });
  const recovery = useRecoveryActions({
    tabs, tabsRef, setTabs, setPendingDrafts, setActiveTabId, setStatus,
    focusEditorSoon: noop,
  });
  const commands = useEditorCommands({
    activeDraft: state.activeDraft, activeTab: state.activeTab, activeTabId,
    agentWorkbenchActive: false, editorPaneRef: { current: null },
    handleSendSelectionToAgent: noop, menuLanguage: "ja",
    requestReviewDraftAgainstDisk: noop, requestReviewTabAgainstDisk: noop,
    setStatus, setTabs,
  });

  return <>
    <output aria-label="Document state">{JSON.stringify({
      tab: state.activeTab,
      dirty: state.activeDirty,
      conflict: state.activeConflict,
      saveError: state.activeSaveError,
    })}</output>
    <StatusBar
      activeDirty={state.activeDirty}
      activeTab={state.activeTab}
      agentLabel={null}
      detail=""
      secondaryDetail=""
      dirtyLabel={state.activeDirty ? "未保存" : ""}
      encodingChipTitle={chromeCopy.encodingChipTitle}
      encodingLabel={chromeCopy.encoding}
      encodingActionLabel={chromeCopy.encodingActionLabel}
      encodingActionPlaceholder={chromeCopy.encodingActionPlaceholder}
      encodingReopenBlocked={chromeCopy.encodingReopenBlocked}
      encodingReopenGroup={chromeCopy.encodingReopenGroup}
      encodingSaveGroup={chromeCopy.encodingSaveGroup}
      lineEndingAriaLabel={chromeCopy.lineEndings}
      lineEndingLabel={chromeCopy.lineEnding}
      lModeEnabled={false}
      onConvertEncoding={commands.convertActiveEncoding}
      onReopenEncoding={(encoding) => {
        if (state.activeTab) void recovery.reopenTabFromDisk(state.activeTab.id, encoding);
      }}
      onConvertLineEnding={commands.convertActiveLineEnding}
      saveAffirmation={false}
      saveAffirmationKey={null}
      statusText={status}
    />
    <RecoveryMessages
      activeConflict={state.activeConflict}
      activeDraft={state.activeDraft}
      activeError={state.activeError}
      activeSaveError={state.activeSaveError}
      activeTab={state.activeTab}
      copy={recoveryCopy}
      onClearSaveError={recovery.clearSaveError}
      onCloseTabWithoutSaving={noop}
      onDiscardDraft={recovery.discardDraft}
      onDismissError={() => {
        // Match the controller's guard: dismiss ordinary read errors while
        // leaving save failures and real disk conflicts for their own actions.
        if (activeTabId === null) return;
        setTabs((current) => updateTabsById(current, activeTabId, (tab) =>
          tab.error && tab.saveStatus !== "conflict" && tab.saveStatus !== "error"
            ? { ...tab, error: null } : tab));
      }}
      onKeepEditingAfterConflict={recovery.keepEditingAfterConflict}
      onReopenTabFromDisk={recovery.reopenTabFromDisk}
      onRestoreDraft={recovery.restoreDraft}
      onReviewDraftAgainstDisk={noop}
      onReviewTabAgainstDisk={noop}
      onTrySaveAgain={noop}
    />
  </>;
}

function documentState(): {
  tab: EditorTab;
  dirty: boolean;
  conflict: boolean;
  saveError: boolean;
} {
  return JSON.parse(screen.getByLabelText("Document state").textContent!);
}

function chooseEncoding(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: chromeCopy.encodingActionLabel }), {
    target: { value },
  });
}

afterEach(cleanup);
beforeEach(() => files.openTextFile.mockReset());

describe("encoding actions through the status bar and recovery UI", () => {
  it.each([
    ["after dismissing the error", true],
    ["while the error remains visible", false],
  ] as const)("retries another encoding %s without entering a save flow", async (_scenario, dismissFirst) => {
    files.openTextFile.mockRejectedValueOnce(new Error("File is not readable as EUC-JP text."));
    render(<EncodingFlow />);
    const originalTab = documentState().tab;

    chooseEncoding("reopen:euc-jp");

    await screen.findByText(/読み直しに失敗しました。本文とファイルは変更していません/);
    expect(files.openTextFile).toHaveBeenCalledWith(diskFile.path, "euc-jp");
    expect(documentState()).toEqual({
      tab: { ...originalTab, error: expect.stringContaining("EUC-JP") },
      dirty: false, conflict: false, saveError: false,
    });
    expect(screen.queryByText(recoveryCopy.conflictHeading)).toBeNull();
    expect(screen.queryByText(recoveryCopy.saveFailure)).toBeNull();
    expect(screen.queryByRole("button", { name: recoveryCopy.trySaveAgain })).toBeNull();
    const rereadOptions = screen.getByRole("combobox", { name: chromeCopy.encodingActionLabel })
      .querySelectorAll<HTMLOptionElement>('option[value^="reopen:"]');
    expect(Array.from(rereadOptions).every((option) => !option.disabled)).toBe(true);

    if (dismissFirst) {
      fireEvent.click(screen.getByRole("button", { name: recoveryCopy.dismiss }));
      expect(screen.queryByText(/読み直しに失敗しました/)).toBeNull();
      expect(documentState().tab).toEqual(originalTab);
    }

    files.openTextFile.mockResolvedValueOnce({ ...diskFile, encoding: "shift-jis" });
    chooseEncoding("reopen:shift-jis");

    await waitFor(() => expect(documentState().tab.encoding).toBe("shift-jis"));
    expect(files.openTextFile).toHaveBeenLastCalledWith(diskFile.path, "shift-jis");
    expect(documentState()).toMatchObject({
      tab: { contents: diskFile.contents, lastSavedEncoding: "shift-jis", error: null, saveStatus: "idle" },
      dirty: false, conflict: false, saveError: false,
    });
    expect(screen.queryByRole("button", { name: recoveryCopy.dismiss })).toBeNull();
  });

  it("keeps save encoding changes separate and unlocks rereading when the change is reverted", () => {
    render(<EncodingFlow />);
    const originalTab = documentState().tab;

    chooseEncoding("save:shift-jis");

    expect(documentState()).toMatchObject({
      tab: { contents: diskFile.contents, encoding: "shift-jis", lastSavedEncoding: "utf-8" },
      dirty: true, conflict: false, saveError: false,
    });
    expect(screen.getByLabelText("未保存")).toBeTruthy();
    const encodingSelect = screen.getByRole("combobox", { name: chromeCopy.encodingActionLabel });
    expect(Array.from(encodingSelect.querySelectorAll<HTMLOptionElement>('option[value^="reopen:"]'))
      .every((option) => option.disabled)).toBe(true);
    expect(files.openTextFile).not.toHaveBeenCalled();

    chooseEncoding("save:utf-8");

    expect(documentState()).toEqual({ tab: originalTab, dirty: false, conflict: false, saveError: false });
    expect(screen.queryByLabelText("未保存")).toBeNull();
    expect(Array.from(encodingSelect.querySelectorAll<HTMLOptionElement>('option[value^="reopen:"]'))
      .every((option) => !option.disabled)).toBe(true);
    expect(files.openTextFile).not.toHaveBeenCalled();
  });
});
