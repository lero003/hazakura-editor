import { createRef, type RefObject } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoveToTrashConfirmDialog } from "./MoveToTrashConfirmDialog";
import { getWorkspaceFileOpsCopy } from "../../lib/locale";

afterEach(cleanup);

function renderDialog(
  overrides: Partial<{
    cancelButtonRef: RefObject<HTMLButtonElement | null>;
    dialogRef: RefObject<HTMLElement | null>;
    isDirectory: boolean;
    name: string;
    onCancel: () => void;
    onConfirm: () => void;
  }> = {},
) {
  const dialogRef = overrides.dialogRef ?? createRef<HTMLElement | null>();
  const cancelButtonRef =
    overrides.cancelButtonRef ?? createRef<HTMLButtonElement | null>();
  const onCancel = overrides.onCancel ?? vi.fn();
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const props = {
    cancelButtonRef,
    copy: getWorkspaceFileOpsCopy("en"),
    dialogRef,
    isDirectory: overrides.isDirectory ?? false,
    menuLanguage: "en" as const,
    name: overrides.name ?? "draft.md",
    onCancel,
    onConfirm,
  };
  const result = render(<MoveToTrashConfirmDialog {...props} />);
  return { ...result, cancelButtonRef, dialogRef, onCancel, onConfirm };
}

describe("MoveToTrashConfirmDialog v0.18 focus management", () => {
  it("renders the dialog with role/aria-modal and an English description", () => {
    renderDialog({
      isDirectory: false,
      name: "draft.md",
    });

    // container.querySelector("section") で拾って role を属性検証するより、
    // getByRole("dialog") で取得すればアクセシブルな役割の存在自体を検証できる。
    // クラス名や要素種 (section) に依存しないため、リファクタで要素が変わっても
    // 「dialog 役割があること」は保たれる。
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText(/Move the file.+to the Trash/)).toBeTruthy();
  });

  it("uses a folder description when the trashed entry is a directory", () => {
    renderDialog({ isDirectory: true, name: "notes" });
    expect(screen.getByText(/Move the folder.+to the Trash/)).toBeTruthy();
  });

  it("wires dialogRef to the dialog section and cancelButtonRef to Cancel", () => {
    const { cancelButtonRef, dialogRef } = renderDialog();
    const dialog = screen.getByRole("dialog");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    // The same DOM node the dialog renders must be reachable
    // through `dialogRef.current`, otherwise the central focus
    // trap (`useModalKeyboardGuard`) cannot confine Tab to the
    // dialog.
    expect(dialogRef.current).toBe(dialog);
    // The same DOM node the Cancel button renders must be
    // reachable through `cancelButtonRef.current`, otherwise
    // the central initial-focus hook
    // (`useDialogInitialFocus`) cannot land focus on Cancel.
    expect(cancelButtonRef.current).toBe(cancelButton);
  });

  it("calls onConfirm when the Move to Trash button is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the same Cancel / Move to Trash order as the v0.7 close dialogs", () => {
    // The focus trap relies on the first / last focusable
    // element order being stable. Confirm first, Cancel last
    // is the existing v0.7 close-dialog layout and the
    // move-to-trash dialog adopts the same order.
    renderDialog();
    // dialog 内のボタンを role で取得する。.dialog-actions クラス配下の
    // button という階層依存ではなく、dialog ロール配下の button 順序で検証する。
    const dialog = screen.getByRole("dialog");
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    );
    expect(buttons[0]?.textContent).toBe("Move to Trash");
    expect(buttons[1]?.textContent).toBe("Cancel");
  });
});
