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
const workspaceCss = readFileSync(
  `${process.cwd()}/src/styles/workspace.css`,
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

    expect(rule).toMatch(/border-radius:\s*50%/);
    expect(rule).toMatch(/opacity:\s*0\.56/);
    expect(rule).toMatch(/filter:\s*saturate\(0\.95\)/);
  });

  it("keeps Shokou ambient particles visibly colored", () => {
    const rule = ruleBody(appShellCss, ".ambient-shokou .ambient-particle");

    expect(rule).toMatch(/hsl\(var\(--ambient-hue,\s*45\),\s*92%,\s*82%\)/);
    expect(rule).toMatch(/opacity:\s*0\.88/);
    expect(rule).toMatch(/box-shadow:\s*0 0 12px 1px/);
  });

  it("keeps top chrome popovers above the workspace layer", () => {
    expect(appShellCss).toMatch(/\.tabs-row\s*{[\s\S]*z-index:\s*20/);
    expect(appShellCss).toMatch(/\.workspace,[\s\S]*z-index:\s*1/s);
  });

  it("keeps the transparent titlebar draggable without swallowing controls", () => {
    const tabsRow = ruleBody(controlsCss, ".tabs-row");

    expect(tabsRow).toMatch(/-webkit-app-region:\s*drag/);
    expect(tabsRow).toMatch(/--titlebar-control-inset:\s*82px/);
    expect(tabsRow).toMatch(/padding:\s*0\s+14px\s+0\s+var\(--titlebar-control-inset\)/);

    expect(controlsCss).toMatch(
      /\.tab-item,[\s\S]*\.editor-quick-settings,[\s\S]*\.document-meta,[\s\S]*\.distribution-badge,[\s\S]*\.tabs-row button,[\s\S]*\.tabs-row input,[\s\S]*\.tabs-row label,[\s\S]*\.tabs-row \[role="tab"\],[\s\S]*\.tabs-row \[role="menu"\],[\s\S]*\.tabs-row \[role="menuitem"\]\s*{[\s\S]*-webkit-app-region:\s*no-drag/s,
    );
    expect(editorCss).toMatch(
      /\.pane-toggle,[\s\S]*\.pane-review-menu-popover\s*{[\s\S]*-webkit-app-region:\s*no-drag/s,
    );
  });

  it("keeps the editor full-path bar visually quiet", () => {
    const pathBar = ruleBody(workspaceCss, ".editor-document-path-bar");
    const pathBarHover = ruleBody(
      workspaceCss,
      ".editor-document-path-bar:hover,\n.editor-document-path-bar:focus-visible",
    );
    const pathBarActive = ruleBody(workspaceCss, ".editor-document-path-bar:active");
    const sakuraPathBar = ruleBody(
      workspaceCss,
      ':root[data-theme="sakura"] .editor-document-path-bar',
    );

    expect(pathBar).toMatch(/background:\s*var\(--cm-bg\)/);
    expect(pathBar).toMatch(/border:\s*0/);
    expect(pathBar).toMatch(/border-radius:\s*0/);
    expect(pathBar).toMatch(/box-shadow:\s*none/);
    expect(pathBar).toMatch(/transform:\s*none/);

    expect(pathBarHover).toMatch(/background:\s*var\(--cm-bg\)/);
    expect(pathBarHover).toMatch(/box-shadow:\s*none/);
    expect(pathBarHover).toMatch(/transform:\s*none/);

    expect(pathBarActive).toMatch(/background:\s*var\(--cm-bg\)/);
    expect(pathBarActive).toMatch(/box-shadow:\s*none/);
    expect(pathBarActive).toMatch(/transform:\s*none/);

    expect(sakuraPathBar).toMatch(/background:\s*linear-gradient/);
    expect(sakuraPathBar).toMatch(/var\(--cm-bg\) 0%/);
    expect(sakuraPathBar).toMatch(/var\(--accent-secondary\)/);
  });

  it("removes the workspace footer trash button border without changing its hit size", () => {
    const trashButton = ruleBody(workspaceCss, ".workspace-trash-button");
    const trashButtonHover = ruleBody(
      workspaceCss,
      ".workspace-trash-button:hover:not(:disabled)",
    );

    expect(trashButton).toMatch(/border:\s*0/);
    expect(trashButton).toMatch(/min-height:\s*32px/);
    expect(trashButton).toMatch(/padding:\s*4px\s+10px/);
    expect(trashButtonHover).not.toMatch(/border-color/);
  });
});
