/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspaceCss = readFileSync(
  `${process.cwd()}/src/styles/workspace.css`,
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
      /:root\[data-theme="dark"\] \.diff-cell\.added,[^}]*:root\[data-theme="yakou"\] \.diff-line-number\.added\s*{[^}]*var\(--diff-added-fg\) 18%/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.removed,[^}]*:root\[data-theme="yakou"\] \.diff-line-number\.removed\s*{[^}]*var\(--diff-removed-fg\) 20%/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.added \.diff-cell-marker,[^}]*:root\[data-theme="yakou"\] \.diff-cell\.added \.diff-cell-marker\s*{[^}]*color:\s*var\(--diff-added-fg\)/s,
    );
    expect(workspaceCss).toMatch(
      /:root\[data-theme="dark"\] \.diff-cell\.removed \.diff-cell-marker,[^}]*:root\[data-theme="yakou"\] \.diff-cell\.removed \.diff-cell-marker\s*{[^}]*color:\s*var\(--diff-removed-fg\)/s,
    );
  });
});
