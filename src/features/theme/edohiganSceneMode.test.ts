import { describe, expect, it } from "vitest";
import { edohiganSceneEnabled } from "./edohiganSceneMode";

describe("edohigan three.js scene switch", () => {
  it("is off unless the spike is explicitly requested", () => {
    expect(edohiganSceneEnabled("")).toBe(false);
    expect(edohiganSceneEnabled("?theme=edohigan")).toBe(false);
    expect(edohiganSceneEnabled("?edohigan3d=0")).toBe(false);
  });

  it("turns on with the query flag", () => {
    expect(edohiganSceneEnabled("?edohigan3d=1")).toBe(true);
    expect(edohiganSceneEnabled("?foo=bar&edohigan3d=1")).toBe(true);
  });
});
