/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chromeCss = readFileSync(
  `${process.cwd()}/src/styles/workspace-chrome.css`,
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    chromeCss.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))
      ?.groups?.body ?? ""
  );
}

describe("workspace-chrome.css", () => {
  it("spreads the display toolbar row across the whole document column", () => {
    // タブ行・表示ツールバー行は文書カラム全幅。プレビュー列の上の帯を空にしない。
    const meta = ruleBody(':root:not([data-l-mode="on"]) .v3-shell .document-meta');
    expect(meta).toMatch(/grid-column:\s*2/);
    expect(meta).toMatch(/justify-self:\s*stretch/);
    expect(
      ruleBody(
        ':root:not([data-l-mode="on"]) .v3-shell .document-meta > .chrome-section:has(.pane-control-cluster.reading-controls)',
      ),
    ).toMatch(/margin-left:\s*auto/);
  });

  it("keeps the chrome bars on the chrome surface and the sidebar on the nav surface", () => {
    expect(chromeCss).toContain("--workspace-chrome-bar: var(--chrome-surface)");
    expect(chromeCss).toContain(".v3-shell .file-tree-pane { background: var(--workspace-chrome-surface)");
  });
});
