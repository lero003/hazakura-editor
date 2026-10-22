import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const css = stripCssComments(readProjectFile("src/styles/edohigan-theme.css"));

describe("edohigan three.js scene layer", () => {
  it("multiplies onto the paper instead of covering it", () => {
    // 明色テーマでは、上に乗る層が紙を明るく置き換えると本文が読めなくなる。
    const scene = ruleBody(css, ".edohigan-scene");
    expect(scene).toContain("mix-blend-mode: multiply");
    expect(scene).toContain("pointer-events: none");
  });

  it("stays under dialogs and the command palette", () => {
    const scene = ruleBody(css, ".edohigan-scene");
    expect(scene).toContain("z-index: calc(var(--z-base) + 1)");
    expect(scene).not.toContain("--z-modal");
    expect(scene).not.toContain("--z-palette");
  });

  it("fills the window without changing the editor layout", () => {
    const scene = ruleBody(css, ".edohigan-scene");
    expect(scene).toContain("position: fixed");
    expect(scene).toContain("inset: 0");
  });
});
