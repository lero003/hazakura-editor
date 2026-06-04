import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChangeReviewView } from "./ChangeReviewView";
import type { CompareCase, CompareViewState } from "../../types";

afterEach(cleanup);

const backupCompareCase: Extract<CompareCase, { kind: "changes" }> = {
  kind: "changes",
  key: "case-1",
  scope: "backup-vs-buffer",
  documentPath: "/workspace/note.md",
  documentLabel: "note.md",
  leftColumnLabel: "Backup",
  rightColumnLabel: "Buffer",
  backupApplyAction: {
    backupName: "20260604_120000_note.md.bak",
    backupContents: "# Restored\n",
  },
};

const emptyView: CompareViewState = {
  caseKey: "case-1",
  lines: [],
  additions: 0,
  removals: 0,
};

describe("ChangeReviewView", () => {
  it("applies an auto-backup to the compared document path", () => {
    const onApplyBackup = vi.fn();

    render(
      <ChangeReviewView
        compareCase={backupCompareCase}
        menuLanguage="en"
        onApplyBackup={onApplyBackup}
        onClose={vi.fn()}
        view={emptyView}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore this backup" }));

    expect(onApplyBackup).toHaveBeenCalledWith(
      "/workspace/note.md",
      "# Restored\n",
    );
  });
});
