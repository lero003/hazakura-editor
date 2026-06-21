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
const animationsCss = readFileSync(
  `${process.cwd()}/src/styles/animations.css`,
  "utf8",
);
const dialogsCss = readFileSync(
  `${process.cwd()}/src/styles/dialogs.css`,
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
    expect(tabList).toMatch(/padding-right:\s*clamp\(40px,\s*3vw,\s*56px\)/);

    expect(tabItem).toMatch(/flex-basis:\s*clamp\(140px,\s*18vw,\s*220px\)/);
    expect(tabItem).toMatch(/flex-grow:\s*1/);
    expect(tabItem).toMatch(/flex-shrink:\s*1/);
    expect(tabItem).toMatch(/max-width:\s*clamp\(180px,\s*24vw,\s*240px\)/);
    expect(tabItem).toMatch(/min-width:\s*clamp\(96px,\s*12vw,\s*140px\)/);
    expect(tabItem).toMatch(/height:\s*30px/);
    expect(activeTabItem).toMatch(/box-shadow:\s*none/);
    expect(activeTabItem).toMatch(/border:\s*1px solid color-mix\(in srgb,\s*var\(--border\) 30%,\s*transparent\)/);

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

  it("keeps Shokou ambient particles as quiet shadow particles", () => {
    const rule = ruleBody(appShellCss, ".ambient-shokou .ambient-particle");

    expect(rule).toMatch(/hsl\(var\(--ambient-hue,\s*222\),\s*24%,\s*28%\)/);
    expect(rule).toMatch(/hsl\(var\(--ambient-hue,\s*222\),\s*18%,\s*14%\)/);
    expect(rule).toMatch(/box-shadow:\s*0 0 4px 1px/);
    expect(rule).toMatch(/0 0 13px 3px/);
    expect(rule).toMatch(/height:\s*var\(--ambient-h,\s*2\.5px\)/);
    expect(rule).toMatch(/width:\s*var\(--ambient-w,\s*2\.5px\)/);
    expect(rule).toMatch(/opacity:\s*0\.5/);
    expect(rule).not.toMatch(/rgba\(255,\s*255,\s*255/);
  });

  it("keeps special theme app shell gradients visible behind native chrome", () => {
    const sakuraShell = ruleBody(appShellCss, ':root[data-theme="sakura"] .app-shell');
    const yakouShell = ruleBody(appShellCss, ':root[data-theme="yakou"] .app-shell');
    const shokouShell = ruleBody(appShellCss, ':root[data-theme="shokou"] .app-shell');

    expect(sakuraShell).toMatch(/background:\s*radial-gradient/);
    expect(sakuraShell).toMatch(/linear-gradient\(145deg/);
    expect(yakouShell).toMatch(/background:\s*radial-gradient/);
    expect(yakouShell).toMatch(/circle at 0% 0%/);
    expect(yakouShell).toMatch(/rgba\(62,\s*119,\s*190,\s*0\.4\)/);
    expect(yakouShell).toMatch(/linear-gradient\(145deg/);
    expect(yakouShell).toMatch(/animation:\s*bgDrift\s+20s/);
    expect(shokouShell).toMatch(/background:\s*linear-gradient\(135deg/);
    expect(shokouShell).toMatch(/animation:\s*bgDrift\s+25s/);
  });

  it("keeps top chrome popovers above the workspace layer", () => {
    expect(appShellCss).toMatch(/\.tabs-row\s*{[\s\S]*z-index:\s*20/);
    expect(appShellCss).toMatch(/\.workspace,[\s\S]*z-index:\s*1/s);
  });

  it("keeps the transparent titlebar draggable without swallowing controls", () => {
    const tabsRow = ruleBody(controlsCss, ".tabs-row");
    const dragStrip = ruleBody(controlsCss, ".window-drag-strip");
    const tabList = ruleBody(controlsCss, ".tab-list");
    const quickSettings = ruleBody(controlsCss, ".editor-quick-settings");
    const documentMeta = ruleBody(editorCss, ".document-meta");

    expect(tabsRow).toMatch(/display:\s*grid/);
    expect(tabsRow).toMatch(/grid-template-rows:\s*34px\s+40px/);
    expect(tabsRow).toMatch(/-webkit-app-region:\s*drag/);
    expect(tabsRow).toMatch(/--titlebar-traffic-light-inset:\s*84px/);
    expect(tabsRow).toMatch(/--titlebar-leading-control-width:\s*44px/);
    expect(tabsRow).toMatch(
      /grid-template-columns:\s*var\(--titlebar-leading-control-width\)\s+calc\(var\(--titlebar-traffic-light-inset\)\s+-\s+var\(--titlebar-leading-control-width\)\)\s+minmax\(0,\s*1fr\)\s+auto/,
    );
    expect(tabsRow).toMatch(/border-bottom:\s*0/);
    expect(tabsRow).toMatch(/height:\s*74px/);
    expect(tabsRow).toMatch(/padding:\s*0\s+14px\s+0\s+0/);
    expect(ruleBody(animationsCss, ".app-shell")).toMatch(
      /grid-template-rows:\s*74px\s+min-content\s+minmax\(0,\s*1fr\)\s+28px/,
    );
    expect(dialogsCss).toMatch(
      /@media \(max-width:\s*1040px\)\s*{[\s\S]*\.app-shell\s*{[^}]*grid-template-rows:\s*74px\s+min-content\s+minmax\(0,\s*1fr\)\s+28px/s,
    );

    expect(dragStrip).toMatch(/grid-column:\s*3\s*\/\s*4/);
    expect(dragStrip).toMatch(/grid-row:\s*1/);
    expect(dragStrip).toMatch(/-webkit-app-region:\s*drag/);
    expect(dragStrip).toMatch(/cursor:\s*default/);

    expect(quickSettings).toMatch(/grid-column:\s*1/);
    expect(quickSettings).toMatch(/grid-row:\s*2/);
    expect(quickSettings).toMatch(/justify-self:\s*center/);
    expect(tabList).toMatch(/grid-column:\s*2\s*\/\s*5/);
    expect(tabList).toMatch(/grid-row:\s*2/);
    expect(documentMeta).toMatch(/grid-column:\s*4/);
    expect(documentMeta).toMatch(/grid-row:\s*1/);
    expect(documentMeta).toMatch(/margin-right:\s*clamp\(20px,\s*1\.6vw,\s*28px\)/);

    expect(controlsCss).toMatch(
      /\.tab-item,[\s\S]*\.editor-quick-settings,[\s\S]*\.document-meta,[\s\S]*\.distribution-badge,[\s\S]*\.tabs-row button,[\s\S]*\.tabs-row input,[\s\S]*\.tabs-row label,[\s\S]*\.tabs-row \[role="tab"\],[\s\S]*\.tabs-row \[role="menu"\],[\s\S]*\.tabs-row \[role="menuitem"\]\s*{[\s\S]*-webkit-app-region:\s*no-drag/s,
    );
    expect(ruleBody(editorCss, ".pane-toggle")).toMatch(
      /-webkit-app-region:\s*no-drag/,
    );
  });

  it("integrates right-pane mode controls into the top chrome", () => {
    const cluster = ruleBody(editorCss, ".pane-control-cluster");
    const group = ruleBody(editorCss, ".pane-toggles");
    const toggle = ruleBody(editorCss, ".pane-toggle");
    const reviewAction = ruleBody(editorCss, ".pane-review-action");
    const activeToggle = ruleBody(editorCss, ".pane-toggle.active");

    expect(cluster).toMatch(/display:\s*flex/);
    expect(cluster).toMatch(/gap:\s*10px/);

    expect(group).toMatch(/background:\s*color-mix/);
    expect(group).toMatch(/border:\s*1px solid/);
    expect(group).toMatch(/border-radius:\s*999px/);
    expect(group).toMatch(/box-shadow:\s*inset 0 1px 0/);
    expect(group).toMatch(/gap:\s*0/);
    expect(group).toMatch(/padding:\s*1px/);

    expect(toggle).toMatch(/border:\s*0/);
    expect(toggle).toMatch(/border-radius:\s*999px/);
    expect(toggle).toMatch(/height:\s*25px/);
    expect(reviewAction).toMatch(/border:\s*1px solid/);
    expect(reviewAction).toMatch(/padding:\s*0\s+9px/);
    expect(activeToggle).toMatch(/background:\s*color-mix/);
    expect(activeToggle).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
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

  it("keeps the startup restore loading surface bound to editor theme tokens", () => {
    const loading = ruleBody(workspaceCss, ".editor-restore-loading");

    expect(loading).toMatch(/background:\s*var\(--cm-bg\)/);
    expect(loading).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(workspaceCss).toMatch(
      /\.editor-restore-loading-line\s*{[\s\S]*var\(--text-muted\)/,
    );
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
