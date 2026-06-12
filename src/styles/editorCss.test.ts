import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorCss = readFileSync(
  `${process.cwd()}/src/styles/editor.css`,
  "utf8",
);
const controlsCss = readFileSync(
  `${process.cwd()}/src/styles/controls.css`,
  "utf8",
);
const appShellCss = readFileSync(
  `${process.cwd()}/src/styles/app-shell.css`,
  "utf8",
);

describe("editor tab close affordance CSS", () => {
  it("keeps tab close controls visually distinct from dirty dots", () => {
    expect(editorCss).toContain(".tab-close-icon");
    expect(editorCss).toContain('data-close-affordance="x"');
    expect(editorCss).not.toMatch(/\.tab-close\s*\{[^}]*border-radius:\s*50%/s);
  });

  it("draws the visible close x from the button itself", () => {
    expect(editorCss).toContain(".tab-close::before");
    expect(editorCss).toContain(".tab-close::after");
    expect(editorCss).toMatch(
      /\.tab-close::before[\s\S]*transform:\s*translate\(-50%, -50%\) rotate\(45deg\)/,
    );
    expect(editorCss).toMatch(
      /\.tab-close::after[\s\S]*transform:\s*translate\(-50%, -50%\) rotate\(-45deg\)/,
    );
    expect(editorCss).toMatch(/\.tab-close::before[\s\S]*background:\s*currentColor/);
    expect(editorCss).toMatch(/\.tab-close::after[\s\S]*background:\s*currentColor/);
  });

  it("keeps the close x hidden until the tab or close button is hovered", () => {
    expect(editorCss).toMatch(/\.tab-close\[data-close-affordance="x"\][\s\S]*opacity:\s*0/);
    expect(editorCss).toMatch(/\.tab-item:hover \.tab-close[\s\S]*opacity:\s*1/);
    expect(editorCss).not.toMatch(/\.tab-item\.active \.tab-close\s*\{[\s\S]*opacity:\s*1/);
  });

  it("keeps the tab hover background on the whole tab item", () => {
    expect(controlsCss).toMatch(/\.tab-item:not\(\.active\):hover\s*\{[\s\S]*background:/);
    expect(controlsCss).toMatch(/\.tab-item\.active:hover\s*\{[\s\S]*background:/);
  });

  it("keeps ambient particles behind readable app surfaces", () => {
    expect(appShellCss).toMatch(/\.ambient\s*{[\s\S]*z-index:\s*0/);
    expect(appShellCss).toMatch(/\.tabs-row\s*{[\s\S]*z-index:\s*20/);
    expect(appShellCss).toMatch(
      /\.workspace,[\s\S]*\.status-bar,[\s\S]*z-index:\s*1/s,
    );
  });

  it("keeps top chrome popovers above the workspace layer", () => {
    expect(appShellCss).toMatch(/\.tabs-row\s*{[\s\S]*z-index:\s*20/);
    expect(appShellCss).toMatch(/\.workspace,[\s\S]*z-index:\s*1/s);
  });
});
