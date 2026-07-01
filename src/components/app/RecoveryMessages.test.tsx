import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecoveryCopy } from "../../lib/locale/recovery";
import { RecoveryMessages } from "./RecoveryMessages";

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
