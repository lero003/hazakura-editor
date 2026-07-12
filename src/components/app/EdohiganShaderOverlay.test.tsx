import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { EdohiganShaderOverlay } from "./EdohiganShaderOverlay";

const edohiganShaderOverlaySource = readFileSync(
  "src/components/app/EdohiganShaderOverlay.tsx",
  "utf8",
);

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

describe("EdohiganShaderOverlay", () => {
  it("keeps the resident canvas on the shared ambient render budget", () => {
    expect(edohiganShaderOverlaySource).toContain(
      "resolveAmbientDevicePixelRatio",
    );
    expect(edohiganShaderOverlaySource).toContain(
      "ambientMinFrameIntervalMs",
    );
    expect(edohiganShaderOverlaySource).toContain(
      "const dpr = resolveAmbientDevicePixelRatio(intensityRef.current)",
    );
    expect(edohiganShaderOverlaySource).toContain(
      "const minInterval = ambientMinFrameIntervalMs(intensityRef.current)",
    );
  });

  it("renders no canvas when ambient intensity is off", () => {
    mockMatchMedia(false);
    const { container } = render(<EdohiganShaderOverlay intensity="off" />);

    expect(container.querySelector(".edohigan-canvas")).toBeNull();
  });

  it("renders the shader canvas when intensity is enabled and WebGL is unavailable", () => {
    mockMatchMedia(false);
    // WebGL2 が取れなくても canvas 要素自体は描画する。実際のシェーダー描画は
    // 実機 (WKWebView) でのみ走るので、ここではフォールバック要素の存在だけ固定。
    const { container } = render(<EdohiganShaderOverlay intensity="normal" />);

    const canvas = container.querySelector<HTMLCanvasElement>(".edohigan-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not start a render loop under prefers-reduced-motion", () => {
    const matchMedia = mockMatchMedia(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    render(<EdohiganShaderOverlay intensity="normal" />);

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    // reduced-motion では effect が早期 return するので rAF は発火しない
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("re-initializes the GL context when intensity goes off -> on", () => {
    mockMatchMedia(false);
    const getContextSpy = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext",
    ) as unknown as Mock;
    getContextSpy.mockClear();

    // off でマウント: canvas は描かれず、getContext も呼ばれない
    const { rerender } = render(<EdohiganShaderOverlay intensity="off" />);
    expect(getContextSpy).not.toHaveBeenCalled();

    // off -> normal へ切り替え: canvas が mount され、effect が再実行されて
    // GL コンテキストの取得が再試行される。かつて effect 依存が [] だった時は
    // ここで getContext が呼ばれず、実機で演出が復帰しない不具合があった。
    rerender(<EdohiganShaderOverlay intensity="normal" />);
    expect(getContextSpy).toHaveBeenCalledWith(
      "webgl2",
      expect.objectContaining({ antialias: false }),
    );
  });
});
