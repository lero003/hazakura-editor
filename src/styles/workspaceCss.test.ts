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
  it("keeps the e-book side pane from using the generic preview scroll", () => {
    expect(ruleBody(".preview-pane")).toMatch(/overflow:\s*auto/);
    expect(ruleBody(".preview-pane-ebook")).toMatch(/overflow:\s*hidden/);
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
