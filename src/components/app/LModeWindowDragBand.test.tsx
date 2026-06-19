import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LModeWindowDragBand } from "./LModeWindowDragBand";

const windowMocks = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging: windowMocks.startDragging,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LModeWindowDragBand", () => {
  it("starts native window dragging from the L Mode blank top band", () => {
    const { container } = render(<LModeWindowDragBand />);

    const dragBand = container.querySelector(
      ".lmode-window-drag-band",
    ) as HTMLElement | null;

    expect(dragBand).toBeTruthy();
    expect(dragBand?.getAttribute("data-tauri-drag-region")).toBe("true");
    expect(dragBand?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.mouseDown(dragBand!, { button: 0 });

    expect(windowMocks.startDragging).toHaveBeenCalledTimes(1);
  });

  it("ignores non-primary mouse buttons", () => {
    const { container } = render(<LModeWindowDragBand />);
    const dragBand = container.querySelector(
      ".lmode-window-drag-band",
    ) as HTMLElement;

    fireEvent.mouseDown(dragBand, { button: 2 });

    expect(windowMocks.startDragging).not.toHaveBeenCalled();
  });
});
