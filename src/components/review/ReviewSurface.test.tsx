import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CompareCase,
  CompareViewState,
  EditorSettings,
  EditorTab,
} from "../../types";
import {
  CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR,
  getReviewDeskCopy,
} from "../../lib/locale";
import { ReviewSurface } from "./ReviewSurface";

vi.mock("../editor/CandidateEditor", () => ({
  CandidateEditor: ({
    ariaLabel,
    onChange,
    readOnly,
    value,
  }: {
    ariaLabel: string;
    onChange: (value: string) => void;
    readOnly: boolean;
    value: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));

vi.mock("../diff/DiffBody", () => ({
  DiffBody: () => <div data-testid="diff-body" />,
}));

afterEach(cleanup);

const activeTab: EditorTab = {
  contents: "# Draft\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "tab-1",
  large_file_warning: false,
  lastSavedContents: "# Draft\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "draft.md",
  path: "/workspace/draft.md",
  saveStatus: "idle",
  size: 8,
};

const editorSettings: EditorSettings = {
  ambientIntensity: "subtle",
  appleAssistDiffInitiallyOpen: true,
  autoBackupEnabled: true,
  editorFontSize: 14,
  lModeEnabled: false,
  lModeFontSize: 18,
  lModeTypewriter: false,
  previewFontSize: 14,
  showInvisibles: false,
  spellcheckEnabled: false,
  tabSize: 2,
  workspaceFontSize: 13,
  wrapLines: true,
};

const emptyView: CompareViewState = {
  caseKey: "candidate-1",
  lines: [],
  additions: 0,
  removals: 0,
};

type ReviewSurfaceProps = Parameters<typeof ReviewSurface>[0];
type RunCandidateCompareParams = Parameters<
  ReviewSurfaceProps["runCandidateCompare"]
>[0];

function renderSurface(
  overrides: Partial<ReviewSurfaceProps> = {},
) {
  return render(
    <ReviewSurface
      activeTab={activeTab}
      candidateCompareCase={null}
      candidateCompareView={null}
      candidateErrorMessage={null}
      candidateFileImportBusy={false}
      candidateFileImportError={null}
      candidateInputSource={{ kind: "manual" }}
      candidateInputText=""
      clearCandidate={vi.fn()}
      editorSettings={editorSettings}
      editorTheme="light"
      menuLanguage="en"
      onApplyCandidate={vi.fn()}
      onClose={vi.fn()}
      onImportCandidateFile={vi.fn().mockResolvedValue(undefined)}
      reviewDeskCopy={getReviewDeskCopy("en")}
      reviewDeskMode="empty"
      runCandidateCompare={vi.fn(() => ({ ok: true as const }))}
      setCandidateInputText={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ReviewSurface", () => {
  it("routes the import file button through the injected handler", () => {
    const onImportCandidateFile = vi.fn().mockResolvedValue(undefined);
    renderSurface({ onImportCandidateFile });

    fireEvent.click(screen.getByRole("button", { name: "Import file" }));

    expect(onImportCandidateFile).toHaveBeenCalledTimes(1);
  });

  it("disables candidate file import when no editor tab is active", () => {
    renderSurface({ activeTab: null });

    expect(
      screen.getByRole("button", { name: "Import file" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the candidate source in the rendered preview metadata", () => {
    const compareCase: Extract<CompareCase, { kind: "candidate" }> = {
      kind: "candidate",
      key: "candidate-1",
      documentTabId: activeTab.id,
      documentContents: activeTab.contents,
      documentPath: activeTab.path,
      documentLabel: activeTab.name,
      leftColumnLabel: "Current buffer",
      rightColumnLabel: "Candidate",
      candidateSourceLabel: "File import: proposal.md",
      candidateText: "# Proposal\n",
      comparedAt: Date.now(),
    };

    renderSurface({
      candidateCompareCase: compareCase,
      candidateCompareView: emptyView,
    });

    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.getByText("File import: proposal.md")).toBeTruthy();
  });

  it("uses the tracked file source when re-comparing an imported candidate", () => {
    const runCandidateCompare = vi.fn(
      (_params: RunCandidateCompareParams) => ({ ok: true as const }),
    );
    renderSurface({
      candidateInputSource: {
        kind: "file",
        name: "proposal.md",
        edited: false,
      },
      candidateInputText: "# Proposal\n",
      runCandidateCompare,
    });

    expect(screen.getByText("File import: proposal.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    expect(runCandidateCompare).toHaveBeenCalledTimes(1);
    expect(runCandidateCompare.mock.calls[0][0]).toMatchObject({
      candidateSourceLabel: "File import: proposal.md",
      candidateText: "# Proposal\n",
    });
  });

  it("marks file-imported candidate text as edited when the source says so", () => {
    renderSurface({
      candidateInputSource: {
        kind: "file",
        name: "proposal.md",
        edited: true,
      },
      candidateInputText: "# Edited proposal\n",
    });

    expect(screen.getByText("File import (edited): proposal.md")).toBeTruthy();
  });

  it("localizes candidate file import errors and allows clearing an error-only state", () => {
    const clearCandidate = vi.fn();
    renderSurface({
      candidateFileImportError: CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR,
      clearCandidate,
      menuLanguage: "ja",
      reviewDeskCopy: getReviewDeskCopy("ja"),
    });

    expect(
      screen.getByText(
        "候補ファイルを読み込むには、エディタでテキストファイルを開いてください。",
      ),
    ).toBeTruthy();

    const clearButton = screen.getByRole("button", { name: "クリア" });
    expect(clearButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(clearButton);

    expect(clearCandidate).toHaveBeenCalledTimes(1);
  });
});
