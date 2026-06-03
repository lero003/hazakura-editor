import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { RenameWarnDialog } from "./RenameWarnDialog";
import { getWorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";

afterEach(cleanup);

describe("RenameWarnDialog", () => {
  it("renders the dirty warning by default", () => {
    render(
      <RenameWarnDialog
        copy={getWorkspaceFileOpsCopy("en")}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        warningKind="dirty"
      />,
    );

    expect(
      screen.getByText("This file has unsaved changes. Rename anyway?"),
    ).toBeTruthy();
  });

  it("renders the external change warning when warningKind is external", () => {
    render(
      <RenameWarnDialog
        copy={getWorkspaceFileOpsCopy("en")}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        warningKind="external"
      />,
    );

    expect(
      screen.getByText("This file was modified outside the app. Rename anyway?"),
    ).toBeTruthy();
  });

  it("invokes onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <RenameWarnDialog
        copy={getWorkspaceFileOpsCopy("en")}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        warningKind="dirty"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Rename" }),
    );

    expect(onConfirm).toHaveBeenCalled();
  });

  it("invokes onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <RenameWarnDialog
        copy={getWorkspaceFileOpsCopy("en")}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        warningKind="external"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel" }),
    );

    expect(onCancel).toHaveBeenCalled();
  });
});
