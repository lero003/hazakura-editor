import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecoveryCopy } from "../../lib/locale/recovery";
import { RecoveryMessages } from "./RecoveryMessages";
import type { DraftRecord, EditorTab } from "../../types";

const confirmDialog = vi.hoisted(() => vi.fn());
vi.mock("../../lib/tauri/nativeDialog", () => ({ confirm: confirmDialog }));
beforeEach(() => { confirmDialog.mockReset(); });

afterEach(cleanup);

const copy = getRecoveryCopy("en");
const noop = vi.fn();

describe("RecoveryMessages", () => {
  it("does not render an empty message row when no recovery message is active", () => {
    const { container } = render(
      <RecoveryMessages
        activeConflict={false}
        activeDraft={null}
        activeError={null}
        activeSaveError={false}
        activeTab={null}
        copy={copy}
        onClearSaveError={noop}
        onCloseTabWithoutSaving={noop}
        onDiscardDraft={noop}
        onDismissError={noop}
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={noop}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    expect(container.querySelector(".message-row")).toBeNull();
  });

  it("renders an active error message", () => {
    const dismissError = vi.fn();

    render(
      <RecoveryMessages
        activeConflict={false}
        activeDraft={null}
        activeError="Could not save"
        activeSaveError={false}
        activeTab={null}
        copy={copy}
        onClearSaveError={noop}
        onCloseTabWithoutSaving={noop}
        onDiscardDraft={noop}
        onDismissError={dismissError}
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={noop}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    expect(screen.getByText("Could not save")).toBeTruthy();
    screen.getByRole("button", { name: copy.dismiss }).click();
    expect(dismissError).toHaveBeenCalledTimes(1);
  });

  it("can hide the draft review action for L Mode recovery banners", () => {
    const review = vi.fn();
    const draft = {
      contents: "draft",
      line_ending: "lf" as const,
      path: "/workspace/note.md",
      savedFingerprint: "fp-disk",
      updatedAt: 1780815960000,
    };
    const tab = {
      contents: "disk",
      encoding: "utf-8" as const,
      error: null,
      externalFingerprint: null,
      fingerprint: "fp-disk",
      id: "tab-1",
      sessionId: "session:tab-1",
      ignoredExternalFingerprint: null,
      large_file_warning: false,
      lastSavedContents: "disk",
      lastSavedEncoding: "utf-8" as const,
      lastSavedLineEnding: "lf" as const,
      line_ending: "lf" as const,
      modified_ms: null,
      name: "note.md",
      path: "/workspace/note.md",
      saveStatus: "idle" as const,
      size: 4,
    };

    render(
      <RecoveryMessages
        activeConflict={false}
        activeDraft={draft}
        activeError={null}
        activeSaveError={false}
        activeTab={tab}
        copy={copy}
        draftReviewAvailable={false}
        onClearSaveError={noop}
        onCloseTabWithoutSaving={noop}
        onDiscardDraft={noop}
        onDismissError={noop}
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={review}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    expect(screen.queryByRole("button", { name: copy.reviewChanges })).toBeNull();
    expect(screen.getByRole("button", { name: copy.restoreDraft })).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.discardDraft })).toBeTruthy();
  });

  it("exposes the message row as a polite live region so banner updates are announced", () => {
    const draft = {
      contents: "draft",
      line_ending: "lf" as const,
      path: "/workspace/note.md",
      savedFingerprint: "fp-disk",
      updatedAt: 1780815960000,
    };
    const tab = {
      contents: "disk",
      encoding: "utf-8" as const,
      error: null,
      externalFingerprint: null,
      fingerprint: "fp-disk",
      id: "tab-1",
      sessionId: "session:tab-2",
      ignoredExternalFingerprint: null,
      large_file_warning: false,
      lastSavedContents: "disk",
      lastSavedEncoding: "utf-8" as const,
      lastSavedLineEnding: "lf" as const,
      line_ending: "lf" as const,
      modified_ms: null,
      name: "note.md",
      path: "/workspace/note.md",
      saveStatus: "idle" as const,
      size: 4,
    };

    const { container } = render(
      <RecoveryMessages
        activeConflict={false}
        activeDraft={draft}
        activeError={null}
        activeSaveError={false}
        activeTab={tab}
        copy={copy}
        onClearSaveError={noop}
        onCloseTabWithoutSaving={noop}
        onDiscardDraft={noop}
        onDismissError={noop}
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={noop}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    const row = container.querySelector(".message-row");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("aria-live")).toBe("polite");
    expect(row?.getAttribute("aria-atomic")).toBe("true");
  });

  it("exposes the error banner message row as a polite live region too", () => {
    const { container } = render(
      <RecoveryMessages
        activeConflict={false}
        activeDraft={null}
        activeError="Could not save"
        activeSaveError={false}
        activeTab={null}
        copy={copy}
        onClearSaveError={noop}
        onCloseTabWithoutSaving={noop}
        onDiscardDraft={noop}
        onDismissError={noop}
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={noop}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    const row = container.querySelector(".message-row");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("aria-live")).toBe("polite");
    expect(row?.getAttribute("aria-atomic")).toBe("true");
  });
});


const confirmationDraft: DraftRecord = {
  contents: "unsaved text", path: "", recoveryId: "confirm-draft", name: "Recovered note",
  line_ending: "lf", savedFingerprint: "fp", updatedAt: 1, origin: "untitled",
};
const confirmationTab: EditorTab = {
  contents: "disk", encoding: "utf-8", error: null, externalFingerprint: null,
  fingerprint: "fp", id: "tab-confirm", sessionId: "session:tab-confirm",
  ignoredExternalFingerprint: null, large_file_warning: false, lastSavedContents: "disk",
  lastSavedEncoding: "utf-8", lastSavedLineEnding: "lf", line_ending: "lf",
  modified_ms: null, name: "note.md", path: "/workspace/note.md", saveStatus: "idle", size: 4,
};

function confirmationProps(draft: DraftRecord, mode: "active" | "pathless", onDiscardDraft = vi.fn()) {
  return {
    activeConflict: false, activeDraft: mode === "active" ? draft : null,
    activeTab: mode === "active" ? confirmationTab : null,
    orphanPathlessDrafts: mode === "pathless" ? [draft] : [],
    activeError: null, activeSaveError: false, copy,
    onClearSaveError: noop, onCloseTabWithoutSaving: noop, onDiscardDraft,
    onDismissError: noop, onKeepEditingAfterConflict: noop, onReopenTabFromDisk: noop,
    onRestoreDraft: noop, onReviewDraftAgainstDisk: noop, onReviewTabAgainstDisk: noop,
    onTrySaveAgain: noop,
  };
}

describe.each(["active", "pathless"] as const)("RecoveryMessages %s discard confirmation", (mode) => {
  const draft = mode === "active" ? { ...confirmationDraft, path: "/workspace/note.md" } : confirmationDraft;

  it("waits for a native answer, ignores repeated clicks, and discards once only after approval", async () => {
    let answer!: (accepted: boolean) => void;
    confirmDialog.mockImplementationOnce(() => new Promise<boolean>((resolve) => { answer = resolve; }));
    const discard = vi.fn();
    render(<RecoveryMessages {...confirmationProps(draft, mode, discard)} />);
    const button = screen.getByRole("button", { name: copy.discardDraft });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(confirmDialog).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
    await act(async () => answer(false));
    expect(discard).not.toHaveBeenCalled();
    confirmDialog.mockResolvedValueOnce(true);
    await act(async () => fireEvent.click(button));
    expect(discard).toHaveBeenCalledExactlyOnceWith(mode === "active" ? `path:${draft.path}` : "pathless:confirm-draft");
  });

  it("fails closed on a dialog error and permits a later confirmed retry", async () => {
    confirmDialog.mockRejectedValueOnce(new Error("dialog unavailable"));
    const discard = vi.fn();
    render(<RecoveryMessages {...confirmationProps(draft, mode, discard)} />);
    const button = screen.getByRole("button", { name: copy.discardDraft });
    await act(async () => fireEvent.click(button));
    expect(discard).not.toHaveBeenCalled();
    confirmDialog.mockResolvedValueOnce(true);
    await act(async () => fireEvent.click(button));
    expect(discard).toHaveBeenCalledOnce();
  });

  it("ignores a delayed approval after unmount", async () => {
    let answer!: (accepted: boolean) => void;
    confirmDialog.mockImplementation(() => new Promise<boolean>((resolve) => { answer = resolve; }));
    const discard = vi.fn();
    const view = render(<RecoveryMessages {...confirmationProps(draft, mode, discard)} />);
    fireEvent.click(screen.getByRole("button", { name: copy.discardDraft }));
    view.unmount();
    await act(async () => answer(true));
    expect(discard).not.toHaveBeenCalled();
  });

  it("does not discard a newer draft under a delayed approval", async () => {
    let answer!: (accepted: boolean) => void;
    confirmDialog.mockImplementation(() => new Promise<boolean>((resolve) => { answer = resolve; }));
    const discard = vi.fn();
    const view = render(<RecoveryMessages {...confirmationProps(draft, mode, discard)} />);
    fireEvent.click(screen.getByRole("button", { name: copy.discardDraft }));
    view.rerender(<RecoveryMessages {...confirmationProps({ ...draft, contents: "new text", updatedAt: 2 }, mode, discard)} />);
    await act(async () => answer(true));
    expect(discard).not.toHaveBeenCalled();
  });
});
