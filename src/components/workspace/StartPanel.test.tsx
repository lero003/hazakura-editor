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
});
