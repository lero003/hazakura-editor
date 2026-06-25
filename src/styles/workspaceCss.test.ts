/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspaceCss = readFileSync(
  `${process.cwd()}/src/styles/workspace.css`,
  "utf8",
);
const tokensCss = readFileSync(
  `${process.cwd()}/src/styles/tokens.css`,
  "utf8",
);
const themesCss = readFileSync(
  `${process.cwd()}/src/styles/themes.css`,
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    workspaceCss.match(
      new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"),
    )?.groups?.body ?? ""
  );
}

describe("workspace.css", () => {
  it("lets native vibrancy drive every theme shell surface", () => {
    for (const theme of ["dark", "light", "sakura", "yakou", "shokou"]) {
      expect(
        ruleBody(`:root[data-theme="${theme}"] .file-tree-pane`),
      ).toMatch(/background:\s*var\(--native-shell-tint\)/);
      expect(
        ruleBody(`:root[data-theme="${theme}"] .workspace-sidebar-rail`),
      ).toMatch(/background:\s*var\(--native-shell-tint\)/);
      expect(ruleBody(`:root[data-theme="${theme}"] .tabs-row`)).toMatch(
        /background:\s*var\(--native-shell-tint\)/,
      );
    }

    expect(workspaceCss).not.toMatch(
      /:root\[data-theme="(?:dark|light|sakura|yakou|shokou)"\] \.(?:file-tree-pane|workspace-sidebar-rail|tabs-row)\s*{[^}]*backdrop-filter/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\]\s*{[^}]*--native-shell-tint:\s*rgba\(14, 19, 17, 0\.12\)/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="shokou"\]\s*{[^}]*--native-shell-tint:\s*rgba\(237, 244, 252, 0\.24\)/s,
    );
  });

  it("keeps standard themes transparent while special themes keep their shell gradients", () => {
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.app-shell,[^}]*:root\[data-theme="light"\] \.app-shell\s*{[^}]*background:\s*transparent/s,
    );
    expect(workspaceCss).not.toMatch(
      /:root\[data-theme="sakura"\] \.app-shell,[^}]*background:\s*transparent/s,
    );
    expect(workspaceCss).not.toMatch(
      /:root\[data-theme="yakou"\] \.app-shell,[^}]*background:\s*transparent/s,
    );
    expect(workspaceCss).not.toMatch(
      /:root\[data-theme="shokou"\] \.app-shell,[^}]*background:\s*transparent/s,
    );
  });

  it("removes hard workspace chrome divider lines from the native shell", () => {
    expect(ruleBody(".file-tree-pane")).toMatch(/border-right:\s*0/);
    expect(ruleBody(".workspace-sidebar-rail")).toMatch(/border-right:\s*0/);
    expect(ruleBody(".workspace-header")).toMatch(/border-bottom:\s*0/);
    expect(ruleBody(".workspace-footer")).toMatch(/border-top:\s*0/);
    expect(ruleBody(".tree-children")).toMatch(/border-left:\s*0/);
  });

  it("keeps the e-book side pane from using the generic preview scroll", () => {
    expect(ruleBody(".preview-pane")).toMatch(/overflow:\s*auto/);
    expect(ruleBody(".preview-pane-ebook")).toMatch(/overflow:\s*hidden/);
  });

  it("lets Reading Focus occupy the workspace without the editor grid", () => {
    expect(ruleBody(".workspace.workspace-reading-focus")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(workspaceCss).toMatch(
      /\.workspace-reading-focus \.file-tree-pane,\n\.workspace-reading-focus \.workspace-sidebar-rail,\n\.workspace-reading-focus \.editor-preview-grid\s*{[^}]*display:\s*none/s,
    );

    const surface = ruleBody(".ebook-reading-focus-surface");
    expect(surface).toMatch(/background:\s*var\(--surface-strong\)/);
    expect(surface).toMatch(/display:\s*flex/);
    expect(surface).toMatch(/min-width:\s*0/);
    expect(surface).toMatch(/overflow:\s*hidden/);
  });

  it("keeps dark and Yakou diff rows high contrast", () => {
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.added,[^}]*:root\[data-theme="yakou"\] \.diff-line-number\.added\s*{[^}]*var\(--diff-added-row-bg\)/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.removed,[^}]*:root\[data-theme="yakou"\] \.diff-line-number\.removed\s*{[^}]*var\(--diff-removed-row-bg\)/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.added \.diff-cell-marker,[^}]*:root\[data-theme="yakou"\] \.diff-cell\.added \.diff-cell-marker\s*{[^}]*color:\s*var\(--diff-added-fg\)/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.removed \.diff-cell-marker,[^}]*:root\[data-theme="yakou"\] \.diff-cell\.removed \.diff-cell-marker\s*{[^}]*color:\s*var\(--diff-removed-fg\)/s,
    );
  });

  it("centers the Local Assist editor lock status without blocking read-only viewing", () => {
    const lock = ruleBody(".editor-apple-assist-lock");
    const lockTitle = ruleBody(".editor-apple-assist-lock strong");
    const lockDetail = ruleBody(".editor-apple-assist-lock span");

    expect(lock).toMatch(/position:\s*absolute/);
    expect(lock).toMatch(/top:\s*50%/);
    expect(lock).toMatch(/left:\s*50%/);
    expect(lock).toMatch(/transform:\s*translate\(-50%, -50%\)/);
    expect(lock).toMatch(/pointer-events:\s*none/);
    expect(lock).toMatch(/padding:\s*14px\s+18px/);
    expect(lock).toMatch(/border-radius:\s*var\(--radius-md\)/);
    expect(lockTitle).toMatch(/font-weight:\s*700/);
    expect(lockDetail).toMatch(/font-size:\s*12px/);
  });

  it("routes diff row backgrounds through theme tokens", () => {
    expect(tokensCss).toMatch(/--diff-added-row-bg:\s*rgba\(46, 125, 85, 0\.08\)/);
    expect(tokensCss).toMatch(/--diff-removed-row-bg:\s*rgba\(158, 63, 67, 0\.08\)/);
    expect(tokensCss).toMatch(/--diff-blank-row-bg:\s*rgba\(127, 127, 127, 0\.04\)/);
    expect(themesCss).toMatch(/--diff-added-row-bg:\s*color-mix\(in srgb, var\(--diff-added-fg\) 18%, transparent\)/);
    expect(themesCss).toMatch(/--diff-removed-row-bg:\s*color-mix\(in srgb, var\(--diff-removed-fg\) 20%, transparent\)/);
    expect(themesCss).toMatch(/--diff-blank-row-bg:\s*color-mix\(in srgb, var\(--text-muted\) 10%, transparent\)/);

    expect(ruleBody(".diff-cell.added,\n.diff-line-number.added")).toMatch(
      /background:\s*var\(--diff-added-row-bg\)/,
    );
    expect(ruleBody(".diff-cell.removed,\n.diff-line-number.removed")).toMatch(
      /background:\s*var\(--diff-removed-row-bg\)/,
    );
    expect(ruleBody(".diff-cell.blank,\n.diff-line-number.blank")).toMatch(
      /background:\s*var\(--diff-blank-row-bg\)/,
    );
  });
});
