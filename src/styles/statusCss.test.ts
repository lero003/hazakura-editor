/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

describe("status bar CSS", () => {
  it("keeps the normal status bar visible while shedding secondary text on narrow windows", () => {
    const statusBarRule =
      previewCss.match(/\.status-bar\s*{(?<body>[^}]*)}/s)?.groups?.body ?? "";
    const detailRule =
      previewCss.match(/\.status-bar-detail\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const directDetailRule =
      previewCss.match(/\.status-bar > \.status-bar-detail\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "";
    const formatGroupRule =
      previewCss.match(/\.status-bar-format-group\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "";
    const mediumRule =
      previewCss.match(
        /@media \(max-width: 860px\)\s*{(?<body>[\s\S]*?)\n}/,
      )?.groups?.body ?? "";
    const compactRule =
      previewCss.match(
        /@media \(max-width: 720px\)\s*{(?<body>[\s\S]*)\n}/,
      )?.groups?.body ?? "";

    expect(statusBarRule).toMatch(/min-height:\s*28px/);
    expect(statusBarRule).toMatch(/overflow:\s*hidden/);
    expect(detailRule).toMatch(/max-width:\s*min\(40ch,\s*38vw\)/);
    expect(directDetailRule).toMatch(/margin-left:\s*auto/);
    expect(formatGroupRule).toMatch(/margin-left:\s*auto/);
    expect(formatGroupRule).toMatch(/flex:\s*0 1 auto/);
    expect(formatGroupRule).toMatch(/max-width:\s*min\(64ch,\s*72vw\)/);
    expect(formatGroupRule).not.toMatch(/min\(58ch,\s*54vw\)/);
    expect(mediumRule).toMatch(/\.status-bar-detail\s*{[^}]*display:\s*none/s);
    expect(compactRule).toMatch(
      /\.status-bar-format-label\s*{[^}]*display:\s*none/s,
    );
  });

  it("keeps format hover chromatic without whitening the status chips", () => {
    const chipRule =
      previewCss.match(/\.status-bar-format-chip\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const valueRule =
      previewCss.match(/\.status-bar-format-value\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const selectRule =
      previewCss.match(/\.status-bar-format-select\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "";

    expect(chipRule).toMatch(/position:\s*relative/);
    expect(valueRule).toMatch(/color:\s*var\(--status-text\)/);
    expect(valueRule).toMatch(/pointer-events:\s*none/);
    expect(valueRule).toMatch(/white-space:\s*nowrap/);
    expect(selectRule).toMatch(/color-scheme:\s*dark/);
    expect(selectRule).toMatch(/background-color:\s*transparent/);
    expect(selectRule).toMatch(/background-image:\s*none/);
    expect(selectRule).toMatch(/height:\s*100%/);
    expect(selectRule).toMatch(/inset:\s*0/);
    expect(selectRule).toMatch(/min-width:\s*0/);
    expect(selectRule).toMatch(/opacity:\s*0/);
    expect(selectRule).toMatch(/position:\s*absolute/);
    expect(selectRule).toMatch(/width:\s*100%/);
    expect(previewCss).toMatch(
      /\.status-bar-format-chip:hover,[\s\S]*\.status-bar-format-chip:focus-within\s*{[^}]*background:\s*color-mix\(in srgb,\s*var\(--accent\) 24%,\s*transparent\);[^}]*border-color:\s*color-mix\(in srgb,\s*var\(--accent\) 36%,\s*transparent\);[^}]*color:\s*var\(--status-text\)/s,
    );
    expect(previewCss).toMatch(
      /\.status-bar-format-select:hover\s*{[^}]*color:\s*var\(--status-text\)/s,
    );
    expect(previewCss).not.toMatch(
      /\.status-bar-format-chip:hover,[\s\S]*background:\s*color-mix\(in srgb,\s*var\(--status-text\) 14%,\s*transparent\)/s,
    );
    expect(previewCss).not.toMatch(
      /:root\[data-theme="light"\] \.status-bar-format-chip:hover/,
    );
  });
});
