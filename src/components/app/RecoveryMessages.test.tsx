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
        onKeepEditingAfterConflict={noop}
        onReopenTabFromDisk={noop}
        onRestoreDraft={noop}
        onReviewDraftAgainstDisk={noop}
        onReviewTabAgainstDisk={noop}
        onTrySaveAgain={noop}
      />,
    );

    expect(screen.getByText("Could not save")).toBeTruthy();
  });
});
