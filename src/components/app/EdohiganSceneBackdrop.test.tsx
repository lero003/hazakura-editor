import { act, cleanup, render } from "@testing-library/react";
import { Vector3, type Camera, type Texture } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneIntensityProfile } from "../../features/theme/edohiganScene";
import { EDOHIGAN_SUN_DIRECTION } from "../../features/theme/edohiganLighting";
import { EdohiganSceneBackdrop } from "./EdohiganSceneBackdrop";

const mocks = vi.hoisted(() => ({
  renderers: [] as {
    setSize: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[],
  textureLoads: [] as { texture: Texture; onLoad?: (texture: Texture) => void }[],
  posts: [] as {
    setSize: ReturnType<typeof vi.fn>;
    setRayStrength: ReturnType<typeof vi.fn>;
    present: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[],
}));

// Keep actual scene objects, geometry and uniforms; replace only the GPU boundary.
vi.mock("three", async (importOriginal) => {
  const THREE = await importOriginal<typeof import("three")>();
  return {
    ...THREE,
    WebGLRenderer: class {
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      setClearColor = vi.fn();
      getClearColor = (color: InstanceType<typeof THREE.Color>) => color.set(0);
      getClearAlpha = () => 1;
      setRenderTarget = vi.fn();
      clear = vi.fn();
      clearDepth = vi.fn();
      render = vi.fn();
      dispose = vi.fn();
      constructor() { mocks.renderers.push(this); }
    },
    TextureLoader: class {
      load(_url: string, onLoad?: (texture: Texture) => void) {
        const texture = new THREE.Texture();
        mocks.textureLoads.push({ texture, onLoad });
        return texture;
      }
    },
  };
});

vi.mock("../../features/theme/edohiganPost", () => ({
  createEdohiganPost: () => {
    const post = {
      renderTarget: null,
      setSize: vi.fn(),
      setFocus: vi.fn(),
      setRayStrength: vi.fn(),
      present: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.posts.push(post);
    return post;
  },
}));

vi.mock("../../features/theme/edohiganBlossomSprite", () => ({
  drawBlossomSprite: () => document.createElement("canvas"),
}));

async function mountStill() {
  const view = render(<EdohiganSceneBackdrop intensity="normal" />);
  await act(() => vi.dynamicImportSettled());
  expect(mocks.renderers).toHaveLength(1);
  expect(mocks.posts[0].present).toHaveBeenCalledOnce();
  return view;
}

beforeEach(() => {
  mocks.renderers.length = 0;
  mocks.textureLoads.length = 0;
  mocks.posts.length = 0;
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(window, "requestAnimationFrame");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EdohiganSceneBackdrop reduced motion", () => {
  it("puts visible petals into scene depth so depth of field focuses on the canopy", async () => {
    const view = await mountStill();
    const scene = mocks.renderers[0].render.mock.calls[2][0];
    const blossoms = scene.children.filter((mesh: { geometry?: { getAttribute: (name: string) => unknown } }) =>
      mesh.geometry?.getAttribute("aAnchor"));
    expect(blossoms).toHaveLength(2);
    const depth = blossoms.find((mesh: { material: { colorWrite: boolean } }) => !mesh.material.colorWrite);
    const color = blossoms.find((mesh: { material: { colorWrite: boolean } }) => mesh.material.colorWrite);
    // Depth is cut to the petal shape, while the color pass keeps its soft translucent edges.
    expect(depth.material.depthWrite).toBe(true);
    expect(depth.material.transparent).toBe(false);
    expect(color.material.transparent).toBe(true);
    expect(color.material.depthWrite).toBe(false);
    expect(depth.geometry).toBe(color.geometry);
    expect(depth.material.uniforms).toBe(color.material.uniforms);
    vi.stubGlobal("innerWidth", 900);
    vi.stubGlobal("innerHeight", 700);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(depth.position.toArray()).toEqual(color.position.toArray());
    expect(depth.scale.toArray()).toEqual(color.scale.toArray());
    const disposeDepth = vi.spyOn(depth.material, "dispose");
    const disposeGeometry = vi.spyOn(depth.geometry, "dispose");
    view.unmount();
    expect(disposeDepth).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce();
  });

  it("resizes and redraws the still scene without starting an animation loop", async () => {
    await mountStill();
    vi.stubGlobal("innerWidth", 900);
    vi.stubGlobal("innerHeight", 700);

    act(() => window.dispatchEvent(new Event("resize")));

    expect(mocks.renderers[0].setSize).toHaveBeenLastCalledWith(900, 700, false);
    expect(mocks.posts[0].setSize).toHaveBeenLastCalledWith(900, 700);
    expect(mocks.posts[0].present).toHaveBeenCalledTimes(2);
    const sceneCamera = mocks.renderers[0].render.mock.lastCall?.[1];
    expect(sceneCamera.aspect).toBeCloseTo(900 / 700);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("applies a new intensity and redraws with the existing renderer", async () => {
    const view = await mountStill();

    view.rerender(<EdohiganSceneBackdrop intensity="dramatic" />);

    expect(mocks.renderers).toHaveLength(1);
    expect(mocks.posts[0].setRayStrength).toHaveBeenLastCalledWith(
      sceneIntensityProfile("dramatic").rays,
    );
    expect(mocks.posts[0].present).toHaveBeenCalledTimes(2);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("redraws when the asynchronous petal texture loads", async () => {
    await mountStill();
    const load = mocks.textureLoads[0];
    expect(load.onLoad).toEqual(expect.any(Function));

    act(() => load.onLoad?.(load.texture));

    expect(mocks.posts[0].present).toHaveBeenCalledTimes(2);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("ignores late texture completion and resize after disposal", async () => {
    const view = await mountStill();
    const load = mocks.textureLoads[0];
    expect(load.onLoad).toEqual(expect.any(Function));
    view.unmount();

    act(() => {
      load.onLoad?.(load.texture);
      window.dispatchEvent(new Event("resize"));
    });

    expect(mocks.posts[0].present).toHaveBeenCalledOnce();
    expect(mocks.posts[0].dispose).toHaveBeenCalledOnce();
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("casts the shadow along the scene sun direction", async () => {
    await mountStill();
    // Shadow is the first pass; the real Three camera includes its lookAt transform.
    const shadowCamera = mocks.renderers[0].render.mock.calls[0][1] as Camera;
    const lightRay = new Vector3(...EDOHIGAN_SUN_DIRECTION).normalize().negate();
    expect(shadowCamera.getWorldDirection(new Vector3()).dot(lightRay)).toBeCloseTo(1, 10);
  });
});
