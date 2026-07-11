// Focused tests for the v0.17 `workspace-tree-role-audit`
// slice. The audit decided to keep the current
// button-based, keyboard-operable model for v0.17 instead
// of adopting a full ARIA `role="tree"` pattern, and to
// document the rationale in
// `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`. These
// tests pin the existing accessible behaviour so any
// future regression in the button model fails the build
// rather than shipping silently.
//
// Each test below matches one of the v0.17 follow-up
// scope items in the decision document:
//
// - `aria-expanded` reflects the directory state
// - The disabled state on a directory button during
//   async `onLoadDirectory` is preserved
// - Rename input `Enter` commits via `onSubmitRename`
// - Rename input `Escape` and blur cancel via
//   `onClearRenaming`
// - The workspace-tree container's `Escape` clears the
//   compare selection only when no rename is active
// - Clicking the container's empty area clears the compare
//   selection when one exists
// - Context menu is reachable on both file and directory
//   rows
//
// The previous single drop-handler test is preserved so the
// audit slice does not regress existing coverage.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { WorkspaceTree } from "./WorkspaceTree";
import type { WorkspaceTreeEntry } from "../../lib/tauri";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rootPath = "/workspace";
const sourcePath = `${rootPath}/source/note.md`;
const draftPath = `${rootPath}/source/draft.md`;
const destPath = `${rootPath}/dest`;
const sourceDirPath = `${rootPath}/source`;
const internalMoveMime = "application/x-hazakura-workspace-move";

function entry(
  name: string,
  path: string,
  kind: WorkspaceTreeEntry["kind"],
  children: WorkspaceTreeEntry[] = [],
  options: { children_loaded?: boolean } = {},
): WorkspaceTreeEntry {
  return {
    children,
    children_loaded: options.children_loaded ?? true,
    children_truncated: false,
    kind,
    name,
    path,
  };
}

function makeTree(): WorkspaceTreeEntry {
  return entry("workspace", rootPath, "directory", [
    entry("source", sourceDirPath, "directory", [
      entry("note.md", sourcePath, "file"),
      entry("draft.md", draftPath, "file"),
    ]),
    // `dest` is intentionally `children_loaded: false` so
    // the loading-state test below can drive the async
    // load path. The other directories stay
    // `children_loaded: true` so they expand synchronously
    // on click and do not need fake-timer plumbing.
    entry("dest", destPath, "directory", [], {
      children_loaded: false,
    }),
  ]);
}

function makeDataTransfer(path: string): DataTransfer {
  return {
    dropEffect: "move",
    effectAllowed: "copyMove",
    getData: vi.fn((type: string) =>
      type === internalMoveMime ? path : "",
    ),
    setData: vi.fn(),
    types: [internalMoveMime],
  } as unknown as DataTransfer;
}

type RenderTreeOverrides = {
  activePath?: string | null;
  compareSourcePath?: string | null;
  compareTargetPath?: string | null;
  compareSelectionEnabled?: boolean;
  onClearCompareSelection?: () => void;
  onLoadDirectory?: (path: string) => Promise<void>;
  onMoveEntry?: (srcPath: string, dstParentPath: string) => void;
  onOpenContextMenu?: ReturnType<typeof vi.fn>;
  onOpenFile?: (path: string) => void | Promise<void>;
  openFilePaths?: readonly string[];
  dirtyFilePaths?: readonly string[];
  onSelectCompareFile?: (entry: WorkspaceTreeEntry) => void;
  onSubmitRename?: (srcPath: string, newName: string) => void;
  renamingPath?: string | null;
  requestRename?: (path: string) => void;
  renameLabel?: string;
};

function renderTree(overrides: RenderTreeOverrides = {}) {
  const onMoveEntry = overrides.onMoveEntry ?? vi.fn();
  const onClearCompareSelection =
    overrides.onClearCompareSelection ?? vi.fn();
  const onLoadDirectory =
    overrides.onLoadDirectory ?? vi.fn(async () => undefined);
  // The mock factory's return type is the loose
  // `Mock<Procedure | Constructable>`, which the strict
  // `WorkspaceTree` prop signature refuses without an
  // explicit cast. The cast is local to this test
  // helper and the surrounding prop drilling still
  // type-checks; production code is unaffected.
  const onOpenContextMenu = (overrides.onOpenContextMenu ??
    vi.fn()) as unknown as ((
    entry: WorkspaceTreeEntry,
    event: import("react").MouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void);
  const onOpenFile = overrides.onOpenFile ?? vi.fn();
  const onSelectCompareFile = overrides.onSelectCompareFile ?? vi.fn();
  const onSubmitRename = overrides.onSubmitRename ?? vi.fn();
  const requestRename = overrides.requestRename ?? vi.fn();

  const view = render(
    <WorkspaceTree
      activePath={overrides.activePath ?? null}
      compareSelectionEnabled={
        overrides.compareSelectionEnabled ?? false
      }
      compareSourcePath={overrides.compareSourcePath ?? null}
      compareTargetPath={overrides.compareTargetPath ?? null}
      dirtyFilePaths={overrides.dirtyFilePaths ?? []}
      entry={makeTree()}
      onClearCompareSelection={onClearCompareSelection}
      onLoadDirectory={onLoadDirectory}
      onMoveEntry={onMoveEntry}
      onOpenContextMenu={onOpenContextMenu}
      onOpenFile={onOpenFile}
      onSelectCompareFile={onSelectCompareFile}
      onSubmitRename={onSubmitRename}
      openFilePaths={overrides.openFilePaths ?? []}
      renameLabel={overrides.renameLabel ?? "Rename"}
      renamingPath={overrides.renamingPath ?? null}
      requestRename={requestRename}
    />,
  );

  return {
    onClearCompareSelection,
    onLoadDirectory,
    onMoveEntry,
    onOpenContextMenu,
    onOpenFile,
    onSelectCompareFile,
    onSubmitRename,
    requestRename,
    view,
  };
}

// The source directory defaults to collapsed in the
// fixture, so a test that needs the nested `note.md`
// button must click the source button first. The 250 ms
// click-debounce uses fake timers, so callers must call
// this inside an `act` block.
function expandDirectory(
  view: ReturnType<typeof render>,
  dirPath: string,
): void {
  const button = view.container.querySelector(
    `button[title="${dirPath}"]`,
  ) as HTMLButtonElement | null;
  if (!button) {
    throw new Error(`expected directory button for ${dirPath}`);
  }
  fireEvent.click(button);
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

describe("WorkspaceTree", () => {
  it("marks open and dirty workspace files without implying git state", () => {
    vi.useFakeTimers();

    const { view } = renderTree({
      activePath: sourcePath,
      dirtyFilePaths: [draftPath],
      openFilePaths: [sourcePath, draftPath],
    });

    expandDirectory(view, sourceDirPath);

    const activeOpenFile = view.container.querySelector(
      `button[title="${sourcePath}"]`,
    );
    const dirtyOpenFile = view.container.querySelector(
      `button[title="${draftPath}"]`,
    );

    expect(activeOpenFile?.classList.contains("active")).toBe(true);
    expect(activeOpenFile?.querySelector(".tree-open-marker")).not.toBeNull();
    expect(activeOpenFile?.querySelector(".tree-dirty-marker")).toBeNull();
    expect(dirtyOpenFile?.querySelector(".tree-open-marker")).not.toBeNull();
    expect(dirtyOpenFile?.querySelector(".tree-dirty-marker")).not.toBeNull();
    expect(dirtyOpenFile?.getAttribute("aria-label")).toContain("unsaved");
  });

  it("drops a workspace entry onto only the target directory", () => {
    const { onMoveEntry, view } = renderTree();
    const destButton = view.container.querySelector(
      `button[title="${destPath}"]`,
    );
    const destDirectory = destButton?.closest(".tree-directory");

    expect(destDirectory).toBeTruthy();

    fireEvent.drop(destDirectory as Element, {
      dataTransfer: makeDataTransfer(sourcePath),
    });

    expect(onMoveEntry).toHaveBeenCalledTimes(1);
    expect(onMoveEntry).toHaveBeenCalledWith(sourcePath, destPath);
  });

  describe("button-based accessibility (v0.17 audit pins)", () => {
    beforeEach(() => {
      // The 250 ms click-debounce in the tree is timer-
      // driven. Every test in this block goes through
      // `expandDirectory` (or a click on a tree button),
      // so fake timers are required to advance past the
      // debounce window synchronously inside `act()`.
      vi.useFakeTimers();
    });

    it("reflects the directory expansion state on aria-expanded", () => {
      // The audit chose to keep the button-based model.
      // Pin the disclosure affordance that already exists:
      // the root directory row is `defaultExpanded`, child
      // directories are not. A future regression that
      // removes `aria-expanded` (e.g. when porting to a
      // different control) breaks the screen-reader
      // disclosure contract even without changing the
      // visual tree.
      const { view } = renderTree();
      const rootButton = view.container.querySelector(
        `button[title="${rootPath}"]`,
      ) as HTMLButtonElement | null;
      const destButton = view.container.querySelector(
        `button[title="${destPath}"]`,
      ) as HTMLButtonElement | null;

      expect(rootButton).toBeTruthy();
      expect(destButton).toBeTruthy();
      // The root directory is `defaultExpanded`, so it is
      // expanded on first render.
      expect(rootButton?.getAttribute("aria-expanded")).toBe("true");
      // Child directories default to collapsed.
      expect(destButton?.getAttribute("aria-expanded")).toBe("false");
    });

    it("disables the directory button while onLoadDirectory is pending", async () => {
      // Use a manually-controlled promise so the test can
      // observe the disabled state in flight. The button
      // becomes enabled again after the promise resolves
      // and the directory flips to expanded.
      let resolveLoad: (() => void) | null = null;
      const onLoadDirectory = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLoad = resolve;
          }),
      );
      const { view } = renderTree({ onLoadDirectory });

      // The root is already expanded; expand `dest` to
      // exercise the loading path. `dest` is collapsed by
      // default, so a single click is enough.
      const destButton = view.container.querySelector(
        `button[title="${destPath}"]`,
      ) as HTMLButtonElement;
      expect(destButton.disabled).toBe(false);

      fireEvent.click(destButton);

      // The 250 ms click-debounce window must elapse
      // before the loading state engages.
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Now `onLoadDirectory` has been invoked. The
      // button must be disabled while the promise is
      // pending, and `aria-expanded` stays "false" until
      // the load resolves.
      expect(onLoadDirectory).toHaveBeenCalledWith(destPath);
      expect(destButton.disabled).toBe(true);
      expect(destButton.getAttribute("aria-expanded")).toBe("false");

      // Resolve the load and let React flush. The
      // disabled state is lifted and `aria-expanded`
      // flips to "true" once the directory is expanded.
      await act(async () => {
        resolveLoad?.();
        // Drain any microtasks queued by the resolve.
        await Promise.resolve();
      });

      expect(destButton.disabled).toBe(false);
      expect(destButton.getAttribute("aria-expanded")).toBe("true");
    });

    it("renders the file rename input outside any row <button>", () => {
      // The v0.18 slice moved rename state into a non-button
      // row so the rename <input> is not nested inside a row
      // <button> (a nested-interactive-control risk for
      // VoiceOver / focus / click / blur). This test pins the
      // new DOM shape for file rows; the directory-row
      // counterpart is pinned in the next test.
      vi.useFakeTimers();

      const { view } = renderTree({
        renamingPath: sourcePath,
        requestRename: vi.fn(),
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      if (!input) return;

      // The input must not live inside a <button>. The rename
      // row is a plain <div class="tree-file tree-file-rename">.
      expect(input.closest("button")).toBeNull();

      // The replaceable row is rendered with the rename marker
      // class so the CSS can highlight the active edit.
      const renameRow = input.closest(".tree-file-rename");
      expect(renameRow).toBeTruthy();
      expect(renameRow?.tagName.toLowerCase()).toBe("div");
    });

    it("uses the localized rename label for VoiceOver", () => {
      vi.useFakeTimers();

      const { view } = renderTree({
        renameLabel: "名前を変更",
        renamingPath: sourcePath,
        requestRename: vi.fn(),
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      expect(input?.getAttribute("aria-label")).toBe(
        "名前を変更: note.md",
      );
    });

    it("renders the directory rename input outside any row <button>", () => {
      // The directory branch mirrors the file branch: rename
      // state is a plain <div class="tree-directory-button
      // tree-directory-rename"> holding only the chevron, the
      // folder icon, and the rename <input>. The outer
      // `.tree-directory` <div> still owns the drop handlers.
      vi.useFakeTimers();

      const { view } = renderTree({
        renamingPath: destPath,
        requestRename: vi.fn(),
      });

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      if (!input) return;

      // No <button> ancestor at all. The disclosure button is
      // intentionally absent while renaming.
      expect(input.closest("button")).toBeNull();

      // The rename row keeps the directory-button layout class
      // for visual alignment with the surrounding tree.
      const renameRow = input.closest(".tree-directory-rename");
      expect(renameRow).toBeTruthy();
      expect(renameRow?.tagName.toLowerCase()).toBe("div");
    });

    it("focuses and selects the rename input on entry", () => {
      // The v0.18 slice moved the rename row out of a
      // <button> to avoid a nested interactive control
      // (the rename <input> inside a row <button> was a
      // VoiceOver / focus / click / blur risk; see
      // `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`).
      // This test pins the rename contract that the new DOM
      // still has to keep: focus() and select() run on entry
      // so the rename interaction hands the keyboard to the
      // user without an extra click. A future regression that
      // loses focus on entry, or that breaks the select-all
      // behavior, fails the build.
      vi.useFakeTimers();

      const { view } = renderTree({
        renamingPath: sourcePath,
        requestRename: vi.fn(),
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      if (!input) return;

      // The focus effect is deferred by setTimeout(0) so the
      // input has a chance to mount first. Drain the timer
      // inside `act` so React flushes the focus call.
      act(() => {
        vi.advanceTimersByTime(0);
      });

      const ownerDocument = view.container.ownerDocument;
      expect(ownerDocument.activeElement).toBe(input);
      // `select()` flips the selection to cover the entire
      // value, which the input's `selectionStart` /
      // `selectionEnd` reflect. jsdom exposes both on
      // HTMLInputElement.
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it("commits the rename input on Enter via onSubmitRename", () => {
      // Fake timers so the 250 ms click-debounce does not
      // interfere with the rename input.
      vi.useFakeTimers();

      const onSubmitRename = vi.fn();
      const onClearRenamingRef = vi.fn();
      // WorkspaceTree exposes `onClearRenaming` through
      // `requestRename("")` in production; the test
      // surfaces that as a separate spy by passing a
      // `requestRename` that routes empty to the same
      // handler.
      const requestRename = vi.fn((path: string) => {
        if (path === "") onClearRenamingRef();
      });

      const { view } = renderTree({
        onSubmitRename,
        renamingPath: sourcePath,
        requestRename,
      });

      // The rename input replaces the file row's name
      // when `renamingPath === entry.path`. Source is
      // collapsed by default, so expand it first to
      // expose the file row.
      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      if (!input) return;

      // The initial draft is the entry's name.
      expect(input.value).toBe("note.md");
      // Replace the value, then press Enter.
      fireEvent.change(input, { target: { value: "renamed.md" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onSubmitRename).toHaveBeenCalledTimes(1);
      expect(onSubmitRename).toHaveBeenCalledWith(
        sourcePath,
        "renamed.md",
      );
    });

    it("cancels the rename input on Escape via onClearRenaming", () => {
      vi.useFakeTimers();

      const onSubmitRename = vi.fn();
      const onClearRenamingRef = vi.fn();
      const requestRename = vi.fn((path: string) => {
        if (path === "") onClearRenamingRef();
      });

      const { view } = renderTree({
        onSubmitRename,
        renamingPath: sourcePath,
        requestRename,
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      if (!input) {
        throw new Error("expected rename input to render");
      }

      fireEvent.change(input, { target: { value: "renamed.md" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onSubmitRename).not.toHaveBeenCalled();
      expect(onClearRenamingRef).toHaveBeenCalledTimes(1);
    });

    it("cancels the rename input on blur via onClearRenaming", () => {
      vi.useFakeTimers();

      const onSubmitRename = vi.fn();
      const onClearRenamingRef = vi.fn();
      const requestRename = vi.fn((path: string) => {
        if (path === "") onClearRenamingRef();
      });

      const { view } = renderTree({
        onSubmitRename,
        renamingPath: sourcePath,
        requestRename,
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      if (!input) {
        throw new Error("expected rename input to render");
      }

      fireEvent.blur(input);

      expect(onSubmitRename).not.toHaveBeenCalled();
      expect(onClearRenamingRef).toHaveBeenCalledTimes(1);
    });

    it("clears the compare selection on Escape when no rename is active", () => {
      vi.useFakeTimers();

      const onClearCompareSelection = vi.fn();
      const { view } = renderTree({
        compareSelectionEnabled: true,
        compareSourcePath: sourcePath,
        compareTargetPath: destPath,
        onClearCompareSelection,
      });

      // Real keyboard path: a focused file or directory
      // button receives the Escape key, and the event
      // bubbles to the workspace-tree container, which
      // dispatches the compare-clear. The container
      // itself is not focusable; this is the user path
      // any keyboard user actually takes.
      const destButton = view.container.querySelector(
        `button[title="${destPath}"]`,
      ) as HTMLButtonElement | null;
      if (!destButton) {
        throw new Error("expected dest directory button");
      }
      fireEvent.keyDown(destButton, { key: "Escape" });

      expect(onClearCompareSelection).toHaveBeenCalledTimes(1);
    });

    it("does not clear the compare selection on Escape while renaming", () => {
      // When the user is editing a name, the rename input
      // is the event target and its own Escape handler
      // cancels the rename. The container's Escape must
      // not also clear the compare selection, otherwise
      // pressing Escape in a rename would silently drop
      // the user's compare-mode state.
      vi.useFakeTimers();

      const onClearCompareSelection = vi.fn();
      const onSubmitRename = vi.fn();
      const onClearRenamingRef = vi.fn();
      const requestRename = vi.fn((path: string) => {
        if (path === "") onClearRenamingRef();
      });

      const { view } = renderTree({
        compareSelectionEnabled: true,
        compareSourcePath: sourcePath,
        compareTargetPath: destPath,
        onClearCompareSelection,
        onSubmitRename,
        renamingPath: sourcePath,
        requestRename,
      });

      expandDirectory(view, sourceDirPath);

      const input = view.container.querySelector(
        ".tree-rename-input",
      ) as HTMLInputElement | null;
      if (!input) {
        throw new Error("expected rename input to render");
      }

      fireEvent.keyDown(input, { key: "Escape" });

      expect(onClearCompareSelection).not.toHaveBeenCalled();
      expect(onClearRenamingRef).toHaveBeenCalledTimes(1);
    });

    it("clears the compare selection when the empty area is clicked", () => {
      vi.useFakeTimers();

      const onClearCompareSelection = vi.fn();
      const { view } = renderTree({
        compareSelectionEnabled: true,
        compareSourcePath: sourcePath,
        compareTargetPath: destPath,
        onClearCompareSelection,
      });

      const container = view.container.querySelector(
        ".workspace-tree",
      ) as HTMLElement | null;
      if (!container) {
        throw new Error("expected workspace tree container");
      }

      // The handler only fires when the click target is
      // the container itself (not a child row).
      fireEvent.click(container, { target: container });

      expect(onClearCompareSelection).toHaveBeenCalledTimes(1);
    });

    it("does not clear the compare selection when a child row is clicked", () => {
      vi.useFakeTimers();

      const onClearCompareSelection = vi.fn();
      const onSelectCompareFile = vi.fn();
      const { view } = renderTree({
        compareSelectionEnabled: true,
        compareSourcePath: sourcePath,
        compareTargetPath: destPath,
        onClearCompareSelection,
        onSelectCompareFile,
      });

      // Source is collapsed by default; expand it so the
      // file button is reachable. The expanded
      // directory's button then has `aria-expanded="true"`,
      // so the `note.md` row sits inside the open
      // children container.
      expandDirectory(view, sourceDirPath);

      const fileButton = view.container.querySelector(
        `button[title="${sourcePath}"]`,
      ) as HTMLButtonElement | null;
      if (!fileButton) {
        throw new Error("expected source file button");
      }

      // The 250 ms click-debounce is the only timing
      // concern here; we are not asserting on its result
      // but the click event itself must not bubble up
      // and trigger the container's clear handler.
      fireEvent.click(fileButton);
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(onClearCompareSelection).not.toHaveBeenCalled();
      expect(onSelectCompareFile).toHaveBeenCalledTimes(1);
    });

    it("opens the context menu on right-click of a file row", () => {
      const onOpenContextMenu = vi.fn();
      const { view } = renderTree({ onOpenContextMenu });

      expandDirectory(view, sourceDirPath);

      const fileButton = view.container.querySelector(
        `button[title="${sourcePath}"]`,
      ) as HTMLButtonElement | null;
      if (!fileButton) {
        throw new Error("expected source file button");
      }

      fireEvent.contextMenu(fileButton);

      expect(onOpenContextMenu).toHaveBeenCalledTimes(1);
      const [entryArg, , kind] = onOpenContextMenu.mock.calls[0] ?? [];
      expect(entryArg?.path).toBe(sourcePath);
      expect(kind).toBe("file");
    });

    it("opens the context menu on right-click of a directory row", () => {
      const onOpenContextMenu = vi.fn();
      const { view } = renderTree({ onOpenContextMenu });

      const destButton = view.container.querySelector(
        `button[title="${destPath}"]`,
      ) as HTMLButtonElement | null;
      if (!destButton) {
        throw new Error("expected dest directory button");
      }

      fireEvent.contextMenu(destButton);

      expect(onOpenContextMenu).toHaveBeenCalledTimes(1);
      const [entryArg, , kind] = onOpenContextMenu.mock.calls[0] ?? [];
      expect(entryArg?.path).toBe(destPath);
      expect(kind).toBe("directory");
    });
  });
});
