import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @codemirror/view 6.43.3+ introduced content-DOM / tile-tree regressions
// that manifest in this app as:
//   - wrong caret / focus position
//   - lines vanishing while typing or multi-selecting
//   - mid-document blank regions (worse with wrap + long Markdown)
// Project evidence (docs/current-work.md): 6.43.2 does not show the bug;
// requestMeasure / CSS-only fixes do not heal a corrupted tile tree.
// Keep the pin until a future view release is re-verified on a long
// Japanese Markdown fixture with fences, tables, and wrap enabled.

const packageJson = JSON.parse(
  readFileSync(`${process.cwd()}/package.json`, "utf8"),
) as {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

describe("@codemirror/view pin", () => {
  it("pins view to 6.43.2 in dependencies and overrides", () => {
    expect(packageJson.dependencies?.["@codemirror/view"]).toBe("6.43.2");
    expect(packageJson.overrides?.["@codemirror/view"]).toBe("6.43.2");
  });

  it("installs @codemirror/view 6.43.2 on disk", () => {
    // package.json "exports" block ./package.json, so read the file directly.
    const installed = JSON.parse(
      readFileSync(
        `${process.cwd()}/node_modules/@codemirror/view/package.json`,
        "utf8",
      ),
    ) as { version: string };
    expect(installed.version).toBe("6.43.2");
  });
});
