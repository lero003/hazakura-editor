import { act, cleanup, render } from "@testing-library/react";
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

// change イベントを発火できる matchMedia モック（実行中の OS 設定変更を再現する）。
function mockMatchMediaWithEvents(initial: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return {
    emit(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
  };
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

  it("stops and restarts when prefers-reduced-motion changes while mounted", () => {
    const media = mockMatchMediaWithEvents(false);
    const getContextSpy = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext",
    ) as unknown as Mock;
    getContextSpy.mockClear();

    render(<CrtShaderOverlay intensity="normal" />);
    expect(getContextSpy).toHaveBeenCalledTimes(1);

    // アプリを開いたまま「動きを減らす」へ: effect が張り直され、GL も作り直さない。
    act(() => media.emit(true));
    expect(getContextSpy).toHaveBeenCalledTimes(1);

    // 設定を戻したら初期化からやり直す（canvas は出たまま描画が死なない）。
    act(() => media.emit(false));
    expect(getContextSpy).toHaveBeenCalledTimes(2);
  });

  it("re-initializes the GL context when intensity goes off -> on", () => {
    mockMatchMedia(false);
    const getContextSpy = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext",
    ) as unknown as Mock;
    getContextSpy.mockClear();

    // off でマウント: canvas は描かれず、getContext も呼ばれない
    const { rerender } = render(<CrtShaderOverlay intensity="off" />);
    expect(getContextSpy).not.toHaveBeenCalled();

    // off -> normal へ切り替え: canvas が mount され、effect が再実行されて
    // GL コンテキストの取得が再試行される。かつて effect 依存が [] だった時は
    // ここで getContext が呼ばれず、実機で演出が復帰しない不具合があった。
    rerender(<CrtShaderOverlay intensity="normal" />);
    expect(getContextSpy).toHaveBeenCalledWith(
      "webgl2",
      expect.objectContaining({ antialias: false }),
    );
  });
});
