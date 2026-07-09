import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";

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
    onRename: vi.fn(),
    onRevealInFinder: vi.fn(),
    onSendFullPathToAgent: vi.fn(),
    onSetCompareSource: vi.fn(),
    onSetCompareTarget: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceContextMenu {...props} />);
  return { onImportAsMarkdownDraft, props };
}

describe("WorkspaceContextMenu Import Assist", () => {
  it("offers Markdown draft import for PDF files", () => {
    const { onImportAsMarkdownDraft } = renderMenu();
    const item = screen.getByRole("menuitem", {
      name: "Markdown 下書きとして取り込む…",
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
        name: "Markdown 下書きとして取り込む…",
      }),
    ).toBeNull();
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
        name: "Markdown 下書きとして取り込む…",
      }),
    ).toBeNull();
  });
});
