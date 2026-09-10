/// <reference types="node" />

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesDir = `${process.cwd()}/src/styles`;
const styleFiles = readdirSync(stylesDir).filter((file) => file.endsWith(".css"));

function read(name: string): string {
  return readFileSync(`${stylesDir}/${name}`, "utf8");
}

function ruleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))?.groups
      ?.body ?? ""
  );
}

describe("focus ring", () => {
  it("never thins a focus outline with color-mix", () => {
    // 56% や 60% へ薄めたリングは chrome 面で 3:1 を割る（実測 2.11〜2.66:1）。
    // フォーカスは意味トークン --focus-ring をそのまま使う。
    const offenders = styleFiles.filter((file) =>
      /outline:[^;]*color-mix/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("defines one focus-ring token that defaults to the accent", () => {
    expect(ruleBody(read("tokens.css"), ":root")).toMatch(
      /--focus-ring:\s*var\(--accent\)/,
    );
  });

  it("only references the focus-ring token from focus rules", () => {
    const users = styleFiles.filter((file) => /var\(--focus-ring\)/.test(read(file)));
    // 9個の個別focus宣言 + トークン定義（tokens.css）に限る。
    expect(users.length).toBeGreaterThanOrEqual(5);
    for (const file of users) {
      const css = read(file);
      const matches = css.match(/[^\n]*var\(--focus-ring\)[^\n]*/g) ?? [];
      for (const line of matches) {
        if (file === "tokens.css") continue;
        expect(line).toMatch(/outline:/);
      }
    }
  });
});
