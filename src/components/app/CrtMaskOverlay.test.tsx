import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CRT_MASK_FRAME_INTERVAL_MS,
  CRT_SCANLINE_PITCH_DEVICE_PX,
  CrtMaskOverlay,
} from "./CrtMaskOverlay";

type FillCall = { style: string; args: number[] };

/** 2D context の最小スタブ。走査線タイルと塗りの順序だけを記録する。 */
function createFakeContext() {
  const fills: FillCall[] = [];
  const gradient = () => ({ addColorStop: () => {} });
  const context = {
    fillStyle: "" as unknown,
    clearRect: () => {},
    createPattern: () => ({}) as unknown,
    createLinearGradient: vi.fn(gradient),
    createRadialGradient: gradient,
    fillRect: (...args: number[]) => {
      fills.push({ style: String(context.fillStyle), args });
    },
  };
  return { context, fills };
}

function mockMatchMedia(reduceMotion: boolean) {
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
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
}

let fake = createFakeContext();

beforeEach(() => {
  fake = createFakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => fake.context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(window, "setTimeout");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
});

describe("CrtMaskOverlay", () => {
  it("renders no canvas when the intensity is off", () => {
    mockMatchMedia(false);
    const { container } = render(<CrtMaskOverlay intensity="off" />);
    expect(container.querySelector(".crt-mask")).toBeNull();
  });

  it("draws one scanline system on a device-pixel pitch", () => {
    mockMatchMedia(false);
    const { container } = render(<CrtMaskOverlay intensity="normal" />);

    const canvas = container.querySelector<HTMLCanvasElement>(".crt-mask");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");

    // タイルは 1px 幅 × ピッチ 2 周期。行ごとの alpha が sinus^2 になっている。
    const tileRows = fake.fills.filter(
      (call) => call.args[2] === 1 && call.args[3] === 1,
    );
    expect(tileRows).toHaveLength(CRT_SCANLINE_PITCH_DEVICE_PX * 2);
    const alphas = tileRows.map((call) =>
      Number(call.style.match(/rgba\(0, 0, 0, ([\d.]+)\)/)?.[1] ?? "0"),
    );
    // 蛍光ブルームとガラス反射を足したぶん、走査線は 0.24 まで下げる。
    expect(Math.max(...alphas)).toBeCloseTo(0.24, 3);
    expect(Math.min(...alphas)).toBeGreaterThan(0);
    // 3px ごとに濃い線が来る。
    expect(alphas[0]).toBeCloseTo(alphas[3], 3);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
  });

  it("throttles the mask to 15fps", () => {
    mockMatchMedia(false);
    render(<CrtMaskOverlay intensity="normal" />);
    expect(window.setTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      CRT_MASK_FRAME_INTERVAL_MS,
    );
    expect(CRT_MASK_FRAME_INTERVAL_MS).toBeCloseTo(1000 / 15, 5);
  });

  it("does not draw under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    render(<CrtMaskOverlay intensity="normal" />);
    expect(window.setTimeout).not.toHaveBeenCalled();
    expect(fake.fills).toHaveLength(0);
  });

  it("waits for visibility before drawing a mask mounted in the background", () => {
    mockMatchMedia(false);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<CrtMaskOverlay intensity="normal" />);
    expect(fake.context.createLinearGradient).not.toHaveBeenCalled();
    expect(window.setTimeout).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(fake.context.createLinearGradient).toHaveBeenCalledOnce();
  });

  it("preserves the hum bar phase across a hidden interval", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    render(<CrtMaskOverlay intensity="normal" />);
    act(() => vi.advanceTimersByTime(200));
    const beforePause = fake.context.createLinearGradient.mock.lastCall;

    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    const callsBeforePause = fake.context.createLinearGradient.mock.calls.length;
    act(() => vi.advanceTimersByTime(10_000));
    expect(fake.context.createLinearGradient).toHaveBeenCalledTimes(callsBeforePause);

    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(fake.context.createLinearGradient.mock.lastCall).toEqual(beforePause);
  });
});
