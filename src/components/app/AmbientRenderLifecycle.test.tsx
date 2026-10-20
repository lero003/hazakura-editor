import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientBackground } from "./AmbientBackground";
import { CrtShaderOverlay } from "./CrtShaderOverlay";
import { ShinkaiShaderOverlay } from "./ShinkaiShaderOverlay";
import type { AmbientIntensity } from "../../types";

const renderers = [
  { name: "CRT", element: (intensity: AmbientIntensity) => <CrtShaderOverlay intensity={intensity} /> },
  { name: "Shinkai", element: (intensity: AmbientIntensity) => <ShinkaiShaderOverlay intensity={intensity} /> },
  { name: "particles", element: (intensity: AmbientIntensity) => <AmbientBackground intensity={intensity} mode="yakou" /> },
];

let hidden = false;
let focused = true;
let now = 0;
let nextFrameId = 0;
let frames: Map<number, FrameRequestCallback>;
let draw: ReturnType<typeof vi.fn>;
let getContext: ReturnType<typeof vi.spyOn>;

function frame(deltaMs: number) {
  now += deltaMs;
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of pending) callback(now);
  });
}

beforeEach(() => {
  hidden = false;
  focused = true;
  now = 1;
  nextFrameId = 0;
  frames = new Map();
  draw = vi.fn();
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(2);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrameId;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  const gradient = { addColorStop: vi.fn() };
  const context2d = {
    clearRect: draw,
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const gl = {
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    deleteShader: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform1i: vi.fn(),
    drawArrays: draw,
    deleteProgram: vi.fn(),
    deleteBuffer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage2D: vi.fn(),
    deleteTexture: vi.fn(),
  };
  getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    ((kind: string) => kind === "2d" ? context2d : gl) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(renderers)("$name render lifecycle", ({ element }) => {
  it("cancels hidden frames and resumes even when the pending callback was discarded", () => {
    render(element("normal"));
    frame(20);
    expect(draw).toHaveBeenCalled();
    expect(frames.size).toBe(1);

    hidden = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(0);
    // WKWebView may discard a callback held while hidden. It must not block rescheduling.
    frames.clear();
    draw.mockClear();
    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(1);
    frame(20);
    expect(draw).toHaveBeenCalled();
    expect(frames.size).toBe(1);
  });

  it("does not schedule while initially hidden or blurred, and pauses on blur", () => {
    hidden = true;
    focused = false;
    render(element("normal"));
    expect(frames.size).toBe(0);

    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(0);
    focused = true;
    act(() => window.dispatchEvent(new Event("focus")));
    expect(frames.size).toBe(1);
    frame(20);
    expect(draw).toHaveBeenCalled();
    focused = false;
    act(() => window.dispatchEvent(new Event("blur")));
    expect(frames.size).toBe(0);
  });
});

describe.each(renderers.slice(0, 2))("$name intensity budget", ({ element }) => {
  it("applies both directions of an intensity change without rebuilding WebGL", () => {
    const { container, rerender } = render(element("subtle"));
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(Math.floor(window.innerWidth * 1.5));
    frame(40);
    draw.mockClear();

    rerender(element("dramatic"));
    frame(8);
    expect(canvas.width).toBe(Math.floor(window.innerWidth * 2));
    expect(draw).toHaveBeenCalledTimes(1);
    frame(8);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(getContext).toHaveBeenCalledTimes(1);

    rerender(element("subtle"));
    frame(8);
    expect(canvas.width).toBe(Math.floor(window.innerWidth * 1.5));
    expect(draw).toHaveBeenCalledTimes(2);
    frame(40);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
