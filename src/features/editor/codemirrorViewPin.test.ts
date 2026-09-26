import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @codemirror/view 6.43.3 introduced content-DOM / tile-tree regressions
// that manifest in this app as:
//   - wrong caret / focus position
//   - lines vanishing while typing or multi-selecting
//   - mid-document blank regions (worse with wrap + long Markdown)
// Project evidence (docs/current-work.md): 6.43.2 did not show the bug;
// requestMeasure / CSS-only fixes did not heal a corrupted tile tree.
// 6.43.13 is a v3.2 candidate after upstream tile-tree fixes. This test
// freezes the candidate; real-device Japanese wrap + L Mode acceptance
// remains required before release.

const packageJson = JSON.parse(
  readFileSync(`${process.cwd()}/package.json`, "utf8"),
) as {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

describe("@codemirror/view pin", () => {
  it("pins view to 6.43.13 in dependencies and overrides", () => {
    expect(packageJson.dependencies?.["@codemirror/view"]).toBe("6.43.13");
    expect(packageJson.overrides?.["@codemirror/view"]).toBe("6.43.13");
  });

  it("installs @codemirror/view 6.43.13 on disk", () => {
    // package.json "exports" block ./package.json, so read the file directly.
    const installed = JSON.parse(
      readFileSync(
        `${process.cwd()}/node_modules/@codemirror/view/package.json`,
        "utf8",
      ),
    ) as { version: string };
    expect(installed.version).toBe("6.43.13");
  });
});
