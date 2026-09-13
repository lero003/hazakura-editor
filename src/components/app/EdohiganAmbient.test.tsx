import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdohiganAmbient } from "./EdohiganAmbient";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("EdohiganAmbient", () => {
  it("removes all artwork when off and restores it when enabled", () => {
    const { container, rerender } = render(<EdohiganAmbient intensity="normal" />);
    expect(container.querySelector(".edohigan-branch")).not.toBeNull();
    rerender(<EdohiganAmbient intensity="off" />);
    expect(container.firstChild).toBeNull();
    rerender(<EdohiganAmbient intensity="normal" />);
    expect(container.querySelector(".edohigan-branch")).not.toBeNull();
  });

  it.each([["subtle", 4], ["normal", 8], ["dramatic", 14]] as const)(
    "%s bounds the number of drifting petals to %i", (intensity, count) => {
      const { container } = render(<EdohiganAmbient intensity={intensity} />);
      expect(container.querySelectorAll(".edohigan-petal")).toHaveLength(count);
      expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("works without a WebGL context or a JavaScript animation loop", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<EdohiganAmbient intensity="normal" />);
    expect(getContext).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });

  it("pauses when hidden, resumes when visible, and releases its listener", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const remove = vi.spyOn(document, "removeEventListener");
    const { container, unmount } = render(<EdohiganAmbient intensity="normal" />);
    expect(container.firstElementChild?.getAttribute("data-paused")).toBe("false");
    act(() => {
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(container.firstElementChild?.getAttribute("data-paused")).toBe("true");
    act(() => {
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(container.firstElementChild?.getAttribute("data-paused")).toBe("false");
    unmount();
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
