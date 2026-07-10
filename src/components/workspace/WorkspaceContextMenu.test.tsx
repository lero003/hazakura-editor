import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";

afterEach(() => {
  cleanup();
});

const fileOpsCopy = {
  newFileHere: "New file here",
  newFolderHere: "New folder here",
  rename: "Rename",
  moveToTrash: "Move to Trash",
  moveToTrashTitle: "Trash",
  moveToTrashConfirm: "Move",
  moveToTrashCancel: "Cancel",
} as WorkspaceFileOpsCopy;

function renderMenu(
  overrides: Partial<Parameters<typeof WorkspaceContextMenu>[0]> = {},
) {
  const onImportAsMarkdownDraft = vi.fn();
  const onOpenAsReference = vi.fn();
  const props: Parameters<typeof WorkspaceContextMenu>[0] = {
    activeTabPath: null,
    anchor: {
      path: "/ws/doc.pdf",
      name: "doc.pdf",
      x: 40,
      y: 40,
      canCompare: false,
      kind: "file",
    },
    canSendToAgent: false,
    compareSource: null,
    fileOpsCopy,
    kind: "file",
    menuLanguage: "ja",
    onClearCompareSource: vi.fn(),
    onClose: vi.fn(),
    onCompare: vi.fn(),
    onCopyFullPath: vi.fn(),
    onCreateFileHere: vi.fn(),
    onCreateFolderHere: vi.fn(),
    onImportAsMarkdownDraft,
    onMoveToTrash: vi.fn(),
    onOpen: vi.fn(),
    onOpenAsReference,
    onRename: vi.fn(),
    onRevealInFinder: vi.fn(),
    onSendFullPathToAgent: vi.fn(),
    onSetCompareSource: vi.fn(),
    onSetCompareTarget: vi.fn(),
    referenceCopy: referenceCompareCopy("ja"),
    ...overrides,
  };
  render(<WorkspaceContextMenu {...props} />);
  return { onImportAsMarkdownDraft, onOpenAsReference, props };
}

describe("WorkspaceContextMenu Import Assist", () => {
  it("offers Markdown draft import for PDF files", () => {
    const { onImportAsMarkdownDraft } = renderMenu();
    const item = screen.getByRole("menuitem", {
      name: "下書きを作る…",
    });
    fireEvent.click(item);
    expect(onImportAsMarkdownDraft).toHaveBeenCalledTimes(1);
  });

  it("hides import for ordinary Markdown files", () => {
    renderMenu({
      anchor: {
        path: "/ws/note.md",
        name: "note.md",
        x: 40,
        y: 40,
        canCompare: true,
        kind: "file",
      },
    });
    expect(
      screen.queryByRole("menuitem", {
        name: "下書きを作る…",
      }),
    ).toBeNull();
  });

  it("offers open-as-reference for Markdown files", () => {
    const { onOpenAsReference } = renderMenu({
      anchor: {
        path: "/ws/note.md",
        name: "note.md",
        x: 40,
        y: 40,
        canCompare: true,
        kind: "file",
      },
    });
    const item = screen.getByRole("menuitem", {
      name: "参照として横に開く",
    });
    fireEvent.click(item);
    expect(onOpenAsReference).toHaveBeenCalledTimes(1);
  });

  it("offers open-as-reference for PDF files", () => {
    const { onOpenAsReference } = renderMenu();
    const item = screen.getByRole("menuitem", {
      name: "参照として横に開く",
    });
    fireEvent.click(item);
    expect(onOpenAsReference).toHaveBeenCalledTimes(1);
  });

  it("hides import for directories", () => {
    renderMenu({
      kind: "directory",
      anchor: {
        path: "/ws/docs",
        name: "docs",
        x: 40,
        y: 40,
        canCompare: false,
        kind: "directory",
      },
    });
    expect(
      screen.queryByRole("menuitem", {
        name: "下書きを作る…",
      }),
    ).toBeNull();
  });
});
