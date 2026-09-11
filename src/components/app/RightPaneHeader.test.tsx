import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RightPaneHeader } from "./RightPaneHeader";

afterEach(cleanup);

describe("RightPaneHeader", () => {
  it("renders the title with a short note and its hover text", () => {
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
    // 出せるのは**短い注記**だけ。説明文は呼び出し側が purposeTitle（ホバー）へ回す。
    const note = screen.getByText("continuous scroll");
    expect(note.getAttribute("title")).toBe("/full/path when needed");
    expect(screen.getByRole("button", { name: "Extra" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close side pane" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the note and close when not provided", () => {
    render(
      <RightPaneHeader mode="compare" title="Diff" closeLabel="Close" />,
    );
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
