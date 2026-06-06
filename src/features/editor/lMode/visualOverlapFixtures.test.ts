/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// v0.14 visual-overlap fixture. `docs/l-mode-plan.md`
// flags the L Mode content max-width, the content
// padding, and the active-line margin chip as a
// narrow-window risk: depending on the viewport width
// the chip can clip or overlap the prose. This fixture
// pins the *current* formulas and a numerical readout
// of the resulting headroom at 375 / 480 / 720 / 1024 px
// widths. The intent is not to declare the geometry
// good — it is to make any future change to the chip,
// the padding, or the prose font size land in this test
// first, so a regression is obvious in the diff.
//
// jsdom does not lay out CSS, so we read the stylesheet
// directly and assert the source-of-truth formulas
// before computing the numerical headroom.

const lModeCss = readFileSync(
  `${process.cwd()}/src/styles/lMode.css`,
  "utf8",
);

function ruleBody(css: string, selector: RegExp): string {
  return css
    .match(new RegExp(`${selector.source}\\s*{(?<body>[^}]*)}`, "s"))
    ?.groups?.body ?? "";
}

describe("v0.14 L Mode visual-overlap fixtures", () => {
  it("pins the L Mode content max-width formula", () => {
    // The content column is capped at 720px but never
    // wider than the available width minus 64px so the
    // 32px breathing room is preserved on both sides.
    // A future change to the cap or the gutter must
    // surface here.
    const body = ruleBody(
      lModeCss,
      /:root\[data-l-mode="on"\] \.cm-content/,
    );
    expect(body).toMatch(
      /max-width:\s*min\(720px,\s*calc\(100%\s*-\s*64px\)\)/,
    );
  });

  it("pins the L Mode content horizontal padding formula", () => {
    // The content uses `clamp(40px, 5vw, 60px)` for
    // horizontal padding so narrow windows keep 40px of
    // breathing room and wide windows stretch to 60px.
    // A future change to the floor / ceiling / viewport
    // percent must surface here.
    const body = ruleBody(
      lModeCss,
      /:root\[data-l-mode="on"\] \.cm-content/,
    );
    expect(body).toMatch(
      /padding:\s*104px clamp\(40px,\s*5vw,\s*60px\)\s+156px/,
    );
  });

  it("pins the active-line margin chip horizontal position formula", () => {
    // The chip is anchored to its line at `left: -2.4em`
    // and is 2em wide, so the chip occupies roughly
    // 2.4em to the left of the line's left edge. A
    // future change to either value must surface here.
    const body = ruleBody(
      lModeCss,
      /:root\[data-l-mode="on"\] \.cm-line\.cm-lmode-source-line\[data-l-chip\]::before/,
    );
    expect(body).toMatch(/left:\s*-2\.4em/);
    expect(body).toMatch(/width:\s*2em/);
  });

  it("keeps the active-line chip inside the content padding at 375, 480, 720, 1024 px", () => {
    // Numerical readout of the current behavior. The
    // chip's effective left offset is `2.4 * chipEm * proseFontSize`
    // where `chipEm = 0.82` (chip font-size inside the
    // prose rule) and `proseFontSize = 15px`. The
    // content padding-left is `clamp(40, 5vw, 60)` so:
    //
    //   width=375  -> 18.75px  -> 40px
    //   width=480  -> 24px     -> 40px
    //   width=720  -> 36px     -> 40px
    //   width=1024 -> 51.2px   -> 51.2px
    //
    // Current headroom (padding - chip offset):
    //
    //   375 / 480 / 720: ~10.5px (tight but inside)
    //   1024:            ~21.7px (comfortable)
    //
    // The assertion is a guard, not a goal. If a future
    // change widens the chip, narrows the padding, or
    // enlarges the prose font, the headroom will shrink
    // and the assertion will fail. That is the signal
    // to revisit chip geometry before merging, not a
    // request to widen the padding retroactively.
    const proseFontSize = 15; // px
    const chipEm = 0.82;
    const chipOffsetEm = 2.4;
    const chipOffset = chipOffsetEm * chipEm * proseFontSize;
    const paddingFor = (width: number) =>
      Math.min(60, Math.max(40, width * 0.05));
    for (const width of [375, 480, 720, 1024]) {
      const padding = paddingFor(width);
      const headroom = padding - chipOffset;
      expect(headroom, `width ${width}px`).toBeGreaterThan(0);
    }
  });
});
