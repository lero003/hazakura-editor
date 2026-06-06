import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LModeActionRail } from "./LModeActionRail";
import { getLModeCopy } from "../../lib/locale/lMode";
import { getSafeEditorCopy } from "../../lib/locale/safeEditor";
import { getWorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import type { ChangeReviewSnapshot } from "../../hooks/diff/useCompareExecution";

afterEach(cleanup);

function workspaceSidebarProps() {
  return {
    activePath: null,
    compareSelectionEnabled: false,
    compareSourcePath: null,
    compareTargetPath: null,
    copy: getSafeEditorCopy("en"),
    fileOpsCopy: getWorkspaceFileOpsCopy("en"),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onLoadDirectory: vi.fn(),
    onMoveEntry: vi.fn(),
    onMoveToTrash: vi.fn(),
    onOpenContextMenu: vi.fn(),
    onOpenRootContextMenu: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenWorkspace: vi.fn(),
    onClearCompareSelection: vi.fn(),
    onSelectCompareFile: vi.fn(),
    onSubmitRename: vi.fn(),
    requestRename: vi.fn(),
    renamingPath: null,
    workspaceRootPath: null,
    workspaceTree: null,
  };
}

function changeReviewSnapshot(): ChangeReviewSnapshot {
  return {
    compareCase: {
      kind: "changes",
      key: "case-1",
      scope: "buffer-vs-disk",
      documentPath: "/workspace/note.md",
      documentLabel: "note.md",
      leftColumnLabel: "Disk",
      rightColumnLabel: "Editor",
    },
    compareView: {
      caseKey: "case-1",
      additions: 1,
      removals: 1,
      lines: [
        {
          kind: "removed",
          leftLine: 1,
          rightLine: null,
          text: "before",
        },
        {
          kind: "added",
          leftLine: null,
          rightLine: 1,
          text: "after",
        },
      ],
    },
  };
}

describe("LModeActionRail", () => {
  it("renders the workspace toggle and Apple Local Assist action without review changes when clean", () => {
    render(
      <LModeActionRail
        activeDirty={false}
        activeDocumentPath={null}
        copy={getLModeCopy("en")}
        dirtyLabel=""
        menuLanguage="en"
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn()}
        onToggleTypewriterMode={vi.fn()}
        reviewChangesAvailable={false}
        typewriterModeEnabled={false}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    expect(screen.getByLabelText("L Mode actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open workspace/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Apple Local Assist/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Typewriter mode/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Review changes/ })).toBeNull();
  });

  it("toggles typewriter mode from the action rail", () => {
    const onToggleTypewriterMode = vi.fn();
    render(
      <LModeActionRail
        activeDirty={false}
        activeDocumentPath={null}
        copy={getLModeCopy("en")}
        dirtyLabel=""
        menuLanguage="en"
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn()}
        onToggleTypewriterMode={onToggleTypewriterMode}
        reviewChangesAvailable={false}
        typewriterModeEnabled={true}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    const button = screen.getByRole("button", { name: /Typewriter mode/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("title")).toBeNull();
    expect(screen.getByText("Type")).toBeTruthy();

    fireEvent.click(button);

    expect(onToggleTypewriterMode).toHaveBeenCalledTimes(1);
  });

  it("opens the local change review sheet and invokes Apple Local Assist", async () => {
    const onOpenAppleAssistWindow = vi.fn();
    const onReviewChanges = vi.fn().mockResolvedValue(changeReviewSnapshot());
    render(
      <LModeActionRail
        activeDirty={false}
        activeDocumentPath="/workspace/note.md"
        copy={getLModeCopy("en")}
        dirtyLabel=""
        menuLanguage="en"
        onOpenAppleAssistWindow={onOpenAppleAssistWindow}
        onReviewChanges={onReviewChanges}
        onToggleTypewriterMode={vi.fn()}
        reviewChangesAvailable={true}
        typewriterModeEnabled={false}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apple Local Assist/ }));

    expect(await screen.findByRole("dialog", { name: "Change review" })).toBeTruthy();
    expect(screen.getByText("Changes against disk")).toBeTruthy();
    expect(onReviewChanges).toHaveBeenCalledTimes(1);
    expect(onOpenAppleAssistWindow).toHaveBeenCalledTimes(1);
  });

  it("closes the local change review sheet", async () => {
    render(
      <LModeActionRail
        activeDirty={true}
        activeDocumentPath="/workspace/note.md"
        copy={getLModeCopy("en")}
        dirtyLabel="Unsaved"
        menuLanguage="en"
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn().mockResolvedValue(changeReviewSnapshot())}
        onToggleTypewriterMode={vi.fn()}
        reviewChangesAvailable={true}
        typewriterModeEnabled={false}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    expect(await screen.findByRole("dialog", { name: "Change review" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Change review" })).toBeNull();
  });

  it("opens and closes the L Mode file tree drawer", () => {
    render(
      <LModeActionRail
        activeDirty={false}
        activeDocumentPath={null}
        copy={getLModeCopy("en")}
        dirtyLabel=""
        menuLanguage="en"
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn()}
        onToggleTypewriterMode={vi.fn()}
        reviewChangesAvailable={false}
        typewriterModeEnabled={false}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open workspace/ }));
    expect(screen.getByRole("dialog", { name: "L Mode file tree" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close file tree" }));
    expect(screen.queryByRole("dialog", { name: "L Mode file tree" })).toBeNull();
  });

  it("marks the workspace toggle when the active tab is dirty", () => {
    const { container } = render(
      <LModeActionRail
        activeDirty={true}
        activeDocumentPath="/workspace/note.md"
        copy={getLModeCopy("en")}
        dirtyLabel="Unsaved"
        menuLanguage="en"
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn()}
        onToggleTypewriterMode={vi.fn()}
        reviewChangesAvailable={false}
        typewriterModeEnabled={false}
        workspaceSidebarProps={workspaceSidebarProps()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Open workspace \(Unsaved\)/ }),
    ).toBeTruthy();
    expect(container.querySelector(".l-mode-workspace-unsaved-dot")).toBeTruthy();
  });
});
