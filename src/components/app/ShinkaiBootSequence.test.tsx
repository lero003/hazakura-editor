import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShinkaiBootSequence } from "./ShinkaiBootSequence";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

// jsdom は matchMedia を持たないので定義する。
function mockMatchMedia(matches: boolean) {
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
}

// jsdom は WebGL2 コンテキストを提供しない。getContext は null を返し、
// ShinkaiBootSequence は WebGL 描画をスキップして phase 遷移のみを行う。
// このテストは phase 遷移とガードの契約を検証するもので、シェーダー描画
// 結果は実機目視に委ねる (CrtBootSequence.test.tsx と同じ方針)。

describe("ShinkaiBootSequence", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    vi.useFakeTimers();
  });

  it("fires the boot sequence when trigger goes false → true", () => {
    const { container, rerender } = render(
      <ShinkaiBootSequence intensity="normal" trigger={false} />,
    );

    // trigger=false では何も描画しない
    expect(container.querySelector(".shinkai-boot")).toBeNull();

    act(() => {
      rerender(<ShinkaiBootSequence intensity="normal" trigger={true} />);
    });

    // 発火直後は descend phase
    expect(container.querySelector(".shinkai-boot-descend")).not.toBeNull();

    // awaken phase (1100ms)
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(container.querySelector(".shinkai-boot-awaken")).not.toBeNull();

    // rise phase (1500ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector(".shinkai-boot-rise")).not.toBeNull();

    // surface phase (1700ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector(".shinkai-boot-surface")).not.toBeNull();

    // done phase (2400ms) でオーバーレイが消える
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.querySelector(".shinkai-boot")).toBeNull();
  });

  it("fires on first mount when trigger starts true", () => {
    // アプリ起動時に shinkai テーマなら自動発火すべき
    const { container } = render(
      <ShinkaiBootSequence intensity="normal" trigger={true} />,
    );

    expect(container.querySelector(".shinkai-boot-descend")).not.toBeNull();
  });

  it("does not re-fire while trigger stays true", () => {
    const { container, rerender } = render(
      <ShinkaiBootSequence intensity="normal" trigger={true} />,
    );

    // 一度 done まで進める
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(container.querySelector(".shinkai-boot")).toBeNull();

    // trigger が true のまま再レンダリングしても再発火しない
    act(() => {
      rerender(<ShinkaiBootSequence intensity="normal" trigger={true} />);
    });
    expect(container.querySelector(".shinkai-boot")).toBeNull();
  });

  it("skips the sequence under prefers-reduced-motion", () => {
    mockMatchMedia(true);

    const { container } = render(
      <ShinkaiBootSequence intensity="normal" trigger={true} />,
    );

    // reduce では発火せず即 done
    expect(container.querySelector(".shinkai-boot")).toBeNull();
  });

  it("skips the sequence when intensity is off", () => {
    const { container } = render(
      <ShinkaiBootSequence intensity="off" trigger={true} />,
    );

    // off では他 shinkai 演出と一貫してスキップ
    expect(container.querySelector(".shinkai-boot")).toBeNull();
  });

  it("renders a canvas element for the WebGL boot shader", () => {
    // WebGL 語彙で描くための canvas 要素が存在することを確認。
    // 描画結果は jsdom で検証できないため、要素の存在のみ。
    const { container } = render(
      <ShinkaiBootSequence intensity="normal" trigger={true} />,
    );

    expect(container.querySelector(".shinkai-boot-canvas")).not.toBeNull();
  });
});
