import fs from "node:fs";
import { describe, expect, it } from "vitest";

const appleAssistWindowCss = fs.readFileSync(
  `${process.cwd()}/src/styles/apple-assist-window.css`,
  "utf8",
);

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function ruleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))?.groups
      ?.body ?? ""
  );
}

describe("apple-assist-window.css", () => {
  const css = stripCssComments(appleAssistWindowCss);

  it("keeps the operation feedback panel content-sized rather than taking all remaining height", () => {
    const shell = ruleBody(css, ".apple-assist-window-shell");
    const feedback = ruleBody(css, ".apple-assist-window-feedback");

    expect(shell).not.toMatch(/grid-template-rows:[^;]*1fr/);
    expect(feedback).toMatch(/max-height:\s*(1[4-9]|2[0-9])rem/);
  });
});
