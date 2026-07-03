import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrtBootSequence } from "./CrtBootSequence";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

// jsdom は matchMedia を持たないので、Object.defineProperty で定義する。
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

describe("CrtBootSequence", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    vi.useFakeTimers();
  });

  it("fires the boot sequence when trigger goes false → true", () => {
    const { container, rerender } = render(
      <CrtBootSequence intensity="normal" trigger={false} />,
    );

    // trigger=false では何も描画しない
    expect(container.querySelector(".crt-boot")).toBeNull();

    act(() => {
      rerender(<CrtBootSequence intensity="normal" trigger={true} />);
    });

    // 発火直後は power-on phase
    expect(container.querySelector(".crt-boot-power-on")).not.toBeNull();

    // signal phase (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector(".crt-boot-signal")).not.toBeNull();

    // ready phase (700ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector(".crt-boot-ready")).not.toBeNull();

    // collapse phase (1200ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector(".crt-boot-collapse")).not.toBeNull();

    // done phase (1500ms) でオーバーレイが消える
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector(".crt-boot")).toBeNull();
  });

  it("fires on first mount when trigger starts true", () => {
    // アプリ起動時に crt テーマなら自動発火すべき
    const { container } = render(
      <CrtBootSequence intensity="normal" trigger={true} />,
    );

    expect(container.querySelector(".crt-boot-power-on")).not.toBeNull();
  });

  it("does not re-fire while trigger stays true", () => {
    const { container, rerender } = render(
      <CrtBootSequence intensity="normal" trigger={true} />,
    );

    // 一度 done まで進める
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector(".crt-boot")).toBeNull();

    // trigger が true のまま再レンダリングしても再発火しない
    act(() => {
      rerender(<CrtBootSequence intensity="normal" trigger={true} />);
    });
    expect(container.querySelector(".crt-boot")).toBeNull();
  });

  it("skips the sequence under prefers-reduced-motion", () => {
    mockMatchMedia(true);

    const { container } = render(
      <CrtBootSequence intensity="normal" trigger={true} />,
    );

    // reduce では発火せず即 done
    expect(container.querySelector(".crt-boot")).toBeNull();
  });

  it("skips the sequence when intensity is off", () => {
    const { container } = render(
      <CrtBootSequence intensity="off" trigger={true} />,
    );

    // off では他 CRT 演出と一貫してスキップ
    expect(container.querySelector(".crt-boot")).toBeNull();
  });
});
