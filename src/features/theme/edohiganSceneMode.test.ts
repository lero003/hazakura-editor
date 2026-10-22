import { describe, expect, it } from "vitest";
import { edohiganSceneEnabled } from "./edohiganSceneMode";

describe("edohigan scene switch", () => {
  it("is on by default since v3.4.1", () => {
    expect(edohiganSceneEnabled("")).toBe(true);
    expect(edohiganSceneEnabled("?theme=edohigan")).toBe(true);
    expect(edohiganSceneEnabled("?edohigan3d=1")).toBe(true);
  });

  it("can be turned off at runtime", () => {
    expect(edohiganSceneEnabled("?edohigan3d=0")).toBe(false);
    expect(edohiganSceneEnabled("?foo=bar&edohigan3d=off")).toBe(false);
  });
});
