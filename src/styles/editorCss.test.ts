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

function ruleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))
      ?.groups?.body ?? ""
  );
}

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

  it("shrinks open tabs down to a readable minimum before horizontal scrolling", () => {
    const tabList = ruleBody(controlsCss, ".tab-list");
    const tabItem = ruleBody(controlsCss, ".tab-item");
    const activeTabItem = ruleBody(controlsCss, ".tab-item.active");

    expect(tabList).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(tabList).toMatch(/max-width:\s*none/);
    expect(tabList).toMatch(/overflow-x:\s*auto/);

    expect(tabItem).toMatch(/flex-basis:\s*clamp\(140px,\s*18vw,\s*220px\)/);
    expect(tabItem).toMatch(/flex-grow:\s*1/);
    expect(tabItem).toMatch(/flex-shrink:\s*1/);
    expect(tabItem).toMatch(/max-width:\s*clamp\(180px,\s*24vw,\s*240px\)/);
    expect(tabItem).toMatch(/min-width:\s*clamp\(96px,\s*12vw,\s*140px\)/);

    expect(activeTabItem).toMatch(/flex-basis:\s*clamp\(180px,\s*22vw,\s*280px\)/);
    expect(activeTabItem).toMatch(/flex-grow:\s*1\.25/);
    expect(activeTabItem).toMatch(/flex-shrink:\s*1/);
    expect(activeTabItem).toMatch(/max-width:\s*clamp\(220px,\s*28vw,\s*300px\)/);
    expect(activeTabItem).toMatch(/min-width:\s*clamp\(120px,\s*14vw,\s*180px\)/);
  });

  it("keeps ambient particles above the workspace but below top chrome", () => {
    expect(ruleBody(appShellCss, ".ambient")).toMatch(/z-index:\s*2(?:;|\n)/);
    expect(ruleBody(appShellCss, ".tabs-row")).toMatch(/z-index:\s*20(?:;|\n)/);
    expect(appShellCss).toMatch(
      /\.workspace,[\s\S]*\.status-bar,[\s\S]*z-index:\s*1/s,
    );
  });

  it("keeps Sakura ambient particles restrained", () => {
    const rule = ruleBody(appShellCss, ".ambient-sakura .ambient-particle");

    expect(rule).toMatch(/opacity:\s*0\.48/);
    expect(rule).toMatch(/filter:\s*saturate\(0\.82\)/);
  });

  it("keeps top chrome popovers above the workspace layer", () => {
    expect(appShellCss).toMatch(/\.tabs-row\s*{[\s\S]*z-index:\s*20/);
    expect(appShellCss).toMatch(/\.workspace,[\s\S]*z-index:\s*1/s);
  });
});
