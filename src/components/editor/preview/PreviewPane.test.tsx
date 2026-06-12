import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewPane from "./PreviewPane";

vi.mock("../../../lib/tauri", () => ({
  openWorkspaceImage: vi.fn(),
}));

afterEach(cleanup);

describe("PreviewPane local link routing", () => {
  it("prevents in-preview navigation and forwards the clicked href", () => {
    const onOpenLocalLink = vi.fn();
    render(
      <PreviewPane
        documentPath="/workspace/docs/guide.md"
        onOpenLocalLink={onOpenLocalLink}
        source="[Open note](../notes/%E6%97%A5%E6%9C%AC%E8%AA%9E%20memo.md#section)"
        workspaceRoot="/workspace"
      />,
    );

    const link = screen.getByRole("link", { name: "Open note" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    const clickResult = link.dispatchEvent(event);

    expect(clickResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenLocalLink).toHaveBeenCalledWith(
      "../notes/%E6%97%A5%E6%9C%AC%E8%AA%9E%20memo.md#section",
    );
  });

  it("does not route clicks outside preview links", () => {
    const onOpenLocalLink = vi.fn();
    render(
      <PreviewPane
        onOpenLocalLink={onOpenLocalLink}
        source="Plain paragraph"
      />,
    );

    fireEvent.click(screen.getByText("Plain paragraph"));

    expect(onOpenLocalLink).not.toHaveBeenCalled();
  });
});
