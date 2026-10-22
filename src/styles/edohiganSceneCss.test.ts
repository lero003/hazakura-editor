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

describe("edohigan dawn backdrop", () => {
  it("keeps the sky behind the editor content inside the shell", () => {
    const backdrop = ruleBody(css, ".edohigan-scene-backdrop");
    expect(backdrop).toContain("z-index: -1");
    expect(backdrop).toContain("position: fixed");
    expect(backdrop).toContain("pointer-events: none");
    const shell = css.slice(css.indexOf(".app-shell:has(.edohigan-scene-backdrop)"));
    expect(shell).toContain("isolation: isolate");
  });

  it("keeps the writing surface as a scrim only while the scene exists", () => {
    // 情景が無いときは従来の不透明な紙。:has() の中だけで透かす。
    expect(css).toContain(":root[data-theme=\"edohigan\"] .app-shell:has(.edohigan-scene-backdrop)");
    const editor = ruleBody(
      css,
      ':root[data-theme="edohigan"] .app-shell:has(.edohigan-scene-backdrop) .cm-editor',
    );
    // 「紙」ではなく、中央が明るく外へ薄れる霞。情景が右と下に残る。
    expect(editor).toContain("linear-gradient(");
    expect(editor).toContain("rgba(255, 253, 249, 0.85) 58%");
    expect(editor).toContain("background-color: transparent");
    // 背景をぼかすと木が消えるので使わない。
    expect(editor).not.toContain("backdrop-filter");
  });

  it("keeps the reading surface solid so text never sits on the scene", () => {
    // 読む面は `--surface-paper-solid` のまま。glass 規則で上書きしない。
    const shellRule = css.slice(
      css.indexOf(":root[data-theme=\"edohigan\"] .app-shell:has(.edohigan-scene-backdrop)"),
      css.indexOf(".edohigan-scene-backdrop {"),
    );
    expect(shellRule).not.toContain("--surface-paper-solid");
  });
});
