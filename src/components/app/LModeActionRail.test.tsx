import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LModeActionRail } from "./LModeActionRail";
import { getLModeCopy } from "../../lib/locale/lMode";
import { getSafeEditorCopy } from "../../lib/locale/safeEditor";
import { getWorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import type { ChangeReviewSnapshot } from "../../hooks/diff/useCompareExecution";
import type { AssistSurfacePreference } from "../../types";

afterEach(cleanup);

function workspaceSidebarProps() {
  return {
    activePath: null,
    compareSelectionEnabled: false,
    compareSourcePath: null,
    compareTargetPath: null,
    copy: getSafeEditorCopy("en"),
    dirtyFilePaths: [],
    fileOpsCopy: getWorkspaceFileOpsCopy("en"),
    onCreateFile: vi.fn(),
    onCreateOkfScaffoldMinimal: vi.fn(),
    onCreateOkfScaffoldBookLike: vi.fn(),
    onCreateFolder: vi.fn(),
    onLoadDirectory: vi.fn(),
    onMoveEntry: vi.fn(),
    onMoveToTrash: vi.fn(),
    onOpenContextMenu: vi.fn(),
    onOpenRootContextMenu: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenWorkspace: vi.fn(),
    openFilePaths: [],
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

function changeReviewSnapshotWithCounts(
  additions: number,
  removals: number,
): ChangeReviewSnapshot {
  const base = changeReviewSnapshot();
  return {
    ...base,
    compareView: {
      ...base.compareView,
      additions,
      removals,
    },
  };
}

// Default props for the L Mode action rail. Tests override
// individual fields as needed. The default `assistSurfaceActive`
// is "apple-local" so the Hazakura Local Assist button is visible by
// default; tests that want to hide it pass a different value.
function defaultProps(overrides: Partial<React.ComponentProps<typeof LModeActionRail>> = {}) {
  return {
    activeDirty: false,
    activeDocumentPath: null,
    assistSurfaceActive: "apple-local" as AssistSurfacePreference,
    copy: getLModeCopy("en"),
    dirtyLabel: "",
    menuLanguage: "en" as const,
    onOpenAppleAssistWindow: vi.fn(),
    onReviewChanges: vi.fn(),
    onToggleTypewriterMode: vi.fn(),
    reviewChangesAvailable: false,
    typewriterModeEnabled: false,
    workspaceSidebarProps: workspaceSidebarProps(),
    ...overrides,
  };
}

describe("LModeActionRail", () => {
  it("renders the workspace toggle and Hazakura Local Assist action without review changes when clean", () => {
    render(<LModeActionRail {...defaultProps()} />);

    expect(screen.getByLabelText("L Mode actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open workspace/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hazakura Local Assist/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Typewriter mode/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Review changes/ })).toBeNull();
  });

  it("toggles typewriter mode from the action rail", () => {
    const onToggleTypewriterMode = vi.fn();
    render(
      <LModeActionRail
        {...defaultProps({ onToggleTypewriterMode, typewriterModeEnabled: true })}
      />,
    );

    const button = screen.getByRole("button", { name: /Typewriter mode/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("title")).toBe(
      getLModeCopy("en").actionRailTypewriterTooltip,
    );
    expect(screen.getByText("Type")).toBeTruthy();

    fireEvent.click(button);

    expect(onToggleTypewriterMode).toHaveBeenCalledTimes(1);
  });

  it("surfaces a non-empty tooltip on every visible action rail button", () => {
    const copy = getLModeCopy("en");
    render(
      <LModeActionRail
        {...defaultProps({
          activeDirty: true,
          activeDocumentPath: "/workspace/note.md",
          copy,
          dirtyLabel: "Unsaved",
          reviewChangesAvailable: true,
        })}
      />,
    );

    const appleAssist = screen.getByRole("button", {
      name: /Hazakura Local Assist/,
    });
    expect(appleAssist.getAttribute("title")).toBe(
      copy.actionRailAppleAssistTooltip,
    );
    expect(appleAssist.getAttribute("title")).toMatch(/\S/);

    const typewriter = screen.getByRole("button", {
      name: /Typewriter mode/,
    });
    expect(typewriter.getAttribute("title")).toBe(
      copy.actionRailTypewriterTooltip,
    );
    expect(typewriter.getAttribute("title")).toMatch(/\S/);

    const review = screen.getByRole("button", { name: /Review changes/ });
    expect(review.getAttribute("title")).toBe(
      copy.actionRailReviewChangesTooltip,
    );
    expect(review.getAttribute("title")).toMatch(/\S/);
  });

  it("opens the local change review sheet and invokes Hazakura Local Assist", async () => {
    const onOpenAppleAssistWindow = vi.fn();
    const onReviewChanges = vi.fn().mockResolvedValue(changeReviewSnapshot());
    render(
      <LModeActionRail
        {...defaultProps({
          activeDocumentPath: "/workspace/note.md",
          onOpenAppleAssistWindow,
          onReviewChanges,
          reviewChangesAvailable: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hazakura Local Assist/ }));

    expect(await screen.findByRole("dialog", { name: "Change review" })).toBeTruthy();
    expect(screen.getByText("Changes against disk")).toBeTruthy();
    expect(onReviewChanges).toHaveBeenCalledTimes(1);
    expect(onOpenAppleAssistWindow).toHaveBeenCalledTimes(1);
  });

  it("closes the local change review sheet", async () => {
    render(
      <LModeActionRail
        {...defaultProps({
          activeDirty: true,
          activeDocumentPath: "/workspace/note.md",
          dirtyLabel: "Unsaved",
          onReviewChanges: vi.fn().mockResolvedValue(changeReviewSnapshot()),
          reviewChangesAvailable: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    expect(await screen.findByRole("dialog", { name: "Change review" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Change review" })).toBeNull();
  });

  it("does not open a stale review sheet after the active document changes", async () => {
    let resolveReview:
      | ((snapshot: ChangeReviewSnapshot | null) => void)
      | undefined;
    const onReviewChanges = vi.fn(
      () =>
        new Promise<ChangeReviewSnapshot | null>((resolve) => {
          resolveReview = resolve;
        }),
    );
    const { rerender } = render(
      <LModeActionRail
        {...defaultProps({
          activeDocumentPath: "/workspace/note.md",
          onReviewChanges,
          reviewChangesAvailable: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    expect(onReviewChanges).toHaveBeenCalledTimes(1);

    rerender(
      <LModeActionRail
        {...defaultProps({
          activeDocumentPath: "/workspace/other.md",
          onReviewChanges,
          reviewChangesAvailable: true,
        })}
      />,
    );

    await act(async () => {
      resolveReview?.(changeReviewSnapshot());
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog", { name: "Change review" })).toBeNull();
  });

  it("keeps the newest review request when older requests resolve later", async () => {
    const resolvers: Array<
      (snapshot: ChangeReviewSnapshot | null) => void
    > = [];
    const onReviewChanges = vi.fn(
      () =>
        new Promise<ChangeReviewSnapshot | null>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    render(
      <LModeActionRail
        {...defaultProps({
          activeDocumentPath: "/workspace/note.md",
          onReviewChanges,
          reviewChangesAvailable: true,
        })}
      />,
    );

    const reviewButton = screen.getByRole("button", { name: /Review changes/ });
    fireEvent.click(reviewButton);
    fireEvent.click(reviewButton);
    expect(onReviewChanges).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]?.(changeReviewSnapshotWithCounts(5, 0));
      await Promise.resolve();
    });
    expect(await screen.findByLabelText("+5 / -0")).toBeTruthy();

    await act(async () => {
      resolvers[0]?.(changeReviewSnapshotWithCounts(1, 9));
      await Promise.resolve();
    });
    expect(screen.getByLabelText("+5 / -0")).toBeTruthy();
    expect(screen.queryByLabelText("+1 / -9")).toBeNull();
  });

  // v0.15 polish: after closing the change review sheet, focus
  // should return to the Review changes button so keyboard users
  // can continue navigating the action rail with Tab. Without
  // this, focus falls back to <body> and the next Tab press
  // jumps to the first non-rail control.
  it("returns focus to the Review changes button after closing the sheet", async () => {
    render(
      <LModeActionRail
        {...defaultProps({
          activeDirty: true,
          activeDocumentPath: "/workspace/note.md",
          dirtyLabel: "Unsaved",
          onReviewChanges: vi.fn().mockResolvedValue(changeReviewSnapshot()),
          reviewChangesAvailable: true,
        })}
      />,
    );

    const reviewButton = screen.getByRole("button", { name: /Review changes/ });
    reviewButton.focus();
    fireEvent.click(reviewButton);
    expect(
      await screen.findByRole("dialog", { name: "Change review" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // The action rail's Review changes button should hold focus
    // again, not the body.
    expect(document.activeElement).toBe(reviewButton);
  });

  // v0.15 polish: same focus-restoration rule for the file
  // tree drawer, because the workspace toggle button is the
  // keyboard user's only way back into the rail.
  it("returns focus to the workspace toggle after closing the drawer", () => {
    render(<LModeActionRail {...defaultProps()} />);

    const workspaceToggle = screen.getByRole("button", {
      name: /Open workspace/,
    });
    workspaceToggle.focus();
    fireEvent.click(workspaceToggle);
    expect(
      screen.getByRole("dialog", { name: "L Mode file tree" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close file tree" }));

    expect(document.activeElement).toBe(workspaceToggle);
  });

  // v0.15 polish: Escape is the keyboard user's primary way
  // to leave a drawer or sheet. The Escape handler must route
  // through the same `closeWorkspace` / `closeChangeReview`
  // helpers that the close buttons use, otherwise focus would
  // fall back to <body> and the next Tab press would skip
  // the action rail entirely.
  it("returns focus to the workspace toggle after Escape closes the drawer", () => {
    render(<LModeActionRail {...defaultProps()} />);

    const workspaceToggle = screen.getByRole("button", {
      name: /Open workspace/,
    });
    workspaceToggle.focus();
    fireEvent.click(workspaceToggle);
    expect(
      screen.getByRole("dialog", { name: "L Mode file tree" }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "L Mode file tree" }),
    ).toBeNull();
    expect(document.activeElement).toBe(workspaceToggle);
  });

  it("does not close the workspace drawer on Escape during IME composition", () => {
    render(<LModeActionRail {...defaultProps()} />);

    const workspaceToggle = screen.getByRole("button", {
      name: /Open workspace/,
    });
    fireEvent.click(workspaceToggle);
    expect(
      screen.getByRole("dialog", { name: "L Mode file tree" }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape", isComposing: true });
    expect(
      screen.getByRole("dialog", { name: "L Mode file tree" }),
    ).toBeTruthy();
  });

  it("returns focus to the Review changes button after Escape closes the sheet", async () => {
    render(
      <LModeActionRail
        {...defaultProps({
          activeDirty: true,
          activeDocumentPath: "/workspace/note.md",
          dirtyLabel: "Unsaved",
          onReviewChanges: vi.fn().mockResolvedValue(changeReviewSnapshot()),
          reviewChangesAvailable: true,
        })}
      />,
    );

    const reviewButton = screen.getByRole("button", { name: /Review changes/ });
    reviewButton.focus();
    fireEvent.click(reviewButton);
    expect(
      await screen.findByRole("dialog", { name: "Change review" }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Change review" }),
    ).toBeNull();
    expect(document.activeElement).toBe(reviewButton);
  });

  it("opens and closes the L Mode file tree drawer", () => {
    render(<LModeActionRail {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /Open workspace/ }));
    expect(screen.getByRole("dialog", { name: "L Mode file tree" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close file tree" }));
    expect(screen.queryByRole("dialog", { name: "L Mode file tree" })).toBeNull();
  });

  it("marks the workspace toggle when the active tab is dirty", () => {
    const { container } = render(
      <LModeActionRail
        {...defaultProps({
          activeDirty: true,
          activeDocumentPath: "/workspace/note.md",
          dirtyLabel: "Unsaved",
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Open workspace \(Unsaved\)/ }),
    ).toBeTruthy();
    expect(container.querySelector(".l-mode-workspace-unsaved-dot")).toBeTruthy();
  });

  // v0.15 polish: the Hazakura Local Assist button should only show when
  // the Assist Surface preference is set to "apple-local".
  // Without this guard, a user who turned Hazakura Local Assist
  // off in Preferences would still see a working button inside
  // L Mode — and clicking it would silently toggle nothing.
  describe("Hazakura Local Assist button visibility (v0.15 polish)", () => {
    it("hides the Hazakura Local Assist button when assist surface is 'none'", () => {
      render(
        <LModeActionRail
          {...defaultProps({ assistSurfaceActive: "none" })}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /Hazakura Local Assist/ }),
      ).toBeNull();
    });

    it("hides the Hazakura Local Assist button when assist surface is 'external-cli'", () => {
      render(
        <LModeActionRail
          {...defaultProps({ assistSurfaceActive: "external-cli" })}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /Hazakura Local Assist/ }),
      ).toBeNull();
    });

    it("keeps the Hazakura Local Assist button visible when assist surface is 'apple-local'", () => {
      render(
        <LModeActionRail
          {...defaultProps({ assistSurfaceActive: "apple-local" })}
        />,
      );

      expect(
        screen.getByRole("button", { name: /Hazakura Local Assist/ }),
      ).toBeTruthy();
    });

    it("still shows the Typewriter mode button when Hazakura Local Assist is hidden", () => {
      render(
        <LModeActionRail
          {...defaultProps({ assistSurfaceActive: "none" })}
        />,
      );

      // The other action rail buttons should still be present.
      expect(
        screen.getByRole("button", { name: /Typewriter mode/ }),
      ).toBeTruthy();
    });
  });
});
