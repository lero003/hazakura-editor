import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RightPaneHeader } from "./RightPaneHeader";

afterEach(cleanup);

describe("RightPaneHeader", () => {
  it("renders title, purpose, mode hook, and close action", () => {
    const onClose = vi.fn();
    render(
      <RightPaneHeader
        mode="preview"
        title="Preview"
        purpose="continuous scroll"
        purposeTitle="/full/path when needed"
        closeLabel="Close side pane"
        onClose={onClose}
        actions={<button type="button">Extra</button>}
      />,
    );

    const header = screen.getByTestId("right-pane-header");
    expect(header.getAttribute("data-right-pane-mode")).toBe("preview");
    expect(screen.getByRole("heading", { name: "Preview" })).toBeTruthy();
    const purpose = screen.getByText("continuous scroll");
    expect(purpose.getAttribute("title")).toBe("/full/path when needed");
    expect(screen.getByRole("button", { name: "Extra" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close side pane" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits purpose and close when not provided", () => {
    render(
      <RightPaneHeader mode="compare" title="Diff" closeLabel="Close" />,
    );
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
