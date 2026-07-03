import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChangeReviewView } from "./ChangeReviewView";
import { captureChangeReviewSnapshot } from "../../features/diff/changeReviewStale";
import type { CompareCase, CompareViewState, EditorTab } from "../../types";

afterEach(cleanup);

const comparedTab: EditorTab = {
  contents: "current buffer",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fingerprint",
  id: "/workspace/note.md",
  sessionId: "session:1",
  ignoredExternalFingerprint: null,
  large_file_warning: false,
  lastSavedContents: "saved buffer",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "note.md",
  path: "/workspace/note.md",
  saveStatus: "idle",
  size: 14,
};

const backupCompareCase: Extract<CompareCase, { kind: "changes" }> = {
  kind: "changes",
  key: "case-1",
  scope: "backup-vs-buffer",
  documentPath: "/workspace/note.md",
  documentLabel: "note.md",
  leftColumnLabel: "Backup",
  rightColumnLabel: "Buffer",
  capturedSnapshot: captureChangeReviewSnapshot(comparedTab),
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
        documentTab={comparedTab}
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

  it("shows no stale banner when the buffer matches the captured snapshot", () => {
    render(
      <ChangeReviewView
        compareCase={backupCompareCase}
        documentTab={comparedTab}
        menuLanguage="en"
        onClose={vi.fn()}
        view={emptyView}
      />,
    );

    expect(screen.queryByText("This diff is stale")).toBeNull();
  });

  it("shows the stale banner when the buffer changed after capture", () => {
    render(
      <ChangeReviewView
        compareCase={backupCompareCase}
        documentTab={{ ...comparedTab, contents: "edited after compare" }}
        menuLanguage="en"
        onClose={vi.fn()}
        view={emptyView}
      />,
    );

    expect(screen.getByText("This diff is stale")).toBeTruthy();
    expect(
      screen.getByText(
        "The document changed after this diff was opened",
      ),
    ).toBeTruthy();
  });

  it("shows the tab-closed stale reason when the document tab is null", () => {
    render(
      <ChangeReviewView
        compareCase={backupCompareCase}
        documentTab={null}
        menuLanguage="en"
        onClose={vi.fn()}
        view={emptyView}
      />,
    );

    expect(screen.getByText("This file was closed")).toBeTruthy();
  });

  it("does not run stale detection for fixed-snapshot scopes", () => {
    const draftCase: Extract<CompareCase, { kind: "changes" }> = {
      ...backupCompareCase,
      key: "draft-case",
      scope: "draft-vs-disk",
      backupApplyAction: undefined,
    };

    render(
      <ChangeReviewView
        compareCase={draftCase}
        documentTab={{ ...comparedTab, contents: "completely different" }}
        menuLanguage="en"
        onClose={vi.fn()}
        view={{ ...emptyView, caseKey: "draft-case" }}
      />,
    );

    expect(screen.queryByText("This diff is stale")).toBeNull();
  });
});
