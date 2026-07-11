import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getSafeEditorCopy } from "../../lib/locale";
import { StartPanel } from "./StartPanel";

describe("StartPanel recent file surface", () => {
  it("does not render legacy file recents or pin controls", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    expect(screen.queryByText("Pinned files")).toBeNull();
    expect(screen.queryByText("Recent files")).toBeNull();
    expect(screen.queryByRole("button", { name: "pinned.md" })).toBeNull();
    expect(screen.queryByRole("button", { name: "recent.md" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pin file" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpin file" })).toBeNull();
  });

  it("shows purpose-led write / read / verify hints", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    const panel = document.querySelector(".start-panel");
    expect(panel?.textContent).toContain("Write, read, and verify.");
    expect(panel?.textContent).toMatch(/Write/);
    expect(panel?.textContent).toMatch(/Read/);
    expect(panel?.textContent).toMatch(/Verify/);
    expect(panel?.querySelectorAll(".start-purpose-hints li").length).toBe(3);
  });
});
