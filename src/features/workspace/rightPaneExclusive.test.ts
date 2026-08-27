import { describe, expect, it, vi } from "vitest";
import { bindExclusiveSidePaneOpen } from "./rightPaneExclusive";

describe("bindExclusiveSidePaneOpen", () => {
  it("hides the retained reference column when the side pane opens", () => {
    const setSidePaneOpen = vi.fn();
    const hideReference = vi.fn();
    const setOpen = bindExclusiveSidePaneOpen(setSidePaneOpen, hideReference);

    setOpen(true);

    expect(hideReference).toHaveBeenCalledTimes(1);
    expect(setSidePaneOpen).toHaveBeenCalledWith(true);
  });

  it("does not hide reference when the side pane closes", () => {
    const setSidePaneOpen = vi.fn();
    const hideReference = vi.fn();
    const setOpen = bindExclusiveSidePaneOpen(setSidePaneOpen, hideReference);

    setOpen(false);

    expect(hideReference).not.toHaveBeenCalled();
    expect(setSidePaneOpen).toHaveBeenCalledWith(false);
  });

  it("hides reference when a functional update opens the pane", () => {
    const hideReference = vi.fn();
    const setSidePaneOpen = vi.fn((update: boolean | ((prev: boolean) => boolean)) => {
      if (typeof update === "function") {
        return update(false);
      }
      return update;
    });
    const setOpen = bindExclusiveSidePaneOpen(setSidePaneOpen, hideReference);

    setOpen((open) => !open);

    expect(hideReference).toHaveBeenCalledTimes(1);
  });
});
