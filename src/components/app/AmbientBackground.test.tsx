import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AmbientBackground } from "./AmbientBackground";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
});

// jsdom は 2D canvas を実装しない。描画そのものは実機で確認し、
// ここではレイヤ構成とループのガードだけを固定する。
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function mockMatchMedia(reduceMotion: boolean): Mock {
  const mql: Partial<MediaQueryList> = {
    matches: reduceMotion,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  const fn = vi.fn().mockReturnValue(mql);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: fn,
  });
  return fn;
}

describe("AmbientBackground", () => {
  it.each([
    ["yakou", ".ambient-yakou"],
    ["shokou", ".ambient-shokou"],
  ] as const)("%s draws its particles on a single canvas layer", (mode, className) => {
    mockMatchMedia(false);
    const { container } = render(
      <AmbientBackground intensity="normal" mode={mode} />,
    );

    const layer = container.firstElementChild;
    expect(layer?.classList.contains(className.replace(".", ""))).toBe(true);
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(".ambient-canvas")).toHaveLength(1);
    // 粒の数だけ DOM が増える旧構成を戻さない。
    expect(container.querySelectorAll(".ambient-particle")).toHaveLength(0);
  });

  it("renders nothing when the intensity is off", () => {
    mockMatchMedia(false);
    const { container } = render(
      <AmbientBackground intensity="off" mode="yakou" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not start a render loop under prefers-reduced-motion", () => {
    const matchMedia = mockMatchMedia(true);
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(<AmbientBackground intensity="normal" mode="shokou" />);

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(raf).not.toHaveBeenCalled();
  });

  it("keeps the DOM size independent of the particle count", () => {
    mockMatchMedia(false);
    const subtle = render(
      <AmbientBackground intensity="subtle" mode="yakou" />,
    );
    const subtleLayers = subtle.container.querySelectorAll(".ambient-canvas").length;
    cleanup();
    const dramatic = render(
      <AmbientBackground intensity="dramatic" mode="yakou" />,
    );
    expect(subtleLayers).toBe(1);
    expect(dramatic.container.querySelectorAll(".ambient-canvas")).toHaveLength(1);
  });
});
