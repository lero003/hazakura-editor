import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { CrtShaderOverlay } from "./CrtShaderOverlay";

afterEach(() => {
  cleanup();
  // matchMedia モックを削除して他のテストへ影響しないようにする
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

// jsdom は WebGL を実装しない。getContext("webgl2") は undefined を返すので、
// シェーダー未サポート時のフォールバック経路を検証できる。
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

// jsdom は matchMedia を持たないので、Object.defineProperty で定義する。
function mockMatchMedia(matches: boolean): Mock {
  const mql: Partial<MediaQueryList> = {
    matches,
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

describe("CrtShaderOverlay", () => {
  it("renders no canvas when ambient intensity is off", () => {
    mockMatchMedia(false);
    const { container } = render(<CrtShaderOverlay intensity="off" />);

    expect(container.querySelector(".crt-canvas")).toBeNull();
  });

  it("renders the shader canvas when intensity is enabled and WebGL is unavailable", () => {
    mockMatchMedia(false);
    // WebGL2 が取れなくても canvas 要素自体は描画する。実際のシェーダー描画は
    // 実機 (WKWebView) でのみ走るので、ここではフォールバック要素の存在だけ固定。
    const { container } = render(<CrtShaderOverlay intensity="normal" />);

    const canvas = container.querySelector<HTMLCanvasElement>(".crt-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not start a render loop under prefers-reduced-motion", () => {
    const matchMedia = mockMatchMedia(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    render(<CrtShaderOverlay intensity="normal" />);

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    // reduced-motion では effect が早期 return するので rAF は発火しない
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
