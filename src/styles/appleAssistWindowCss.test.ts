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
    expect(feedback).toMatch(/height:\s*9\.5rem/);
    expect(feedback).toMatch(/min-height:\s*9\.5rem/);
  });

  it("keeps the companion vertically compact for the smaller tool-window height", () => {
    const shell = ruleBody(css, ".apple-assist-window-shell");
    const header = ruleBody(css, ".apple-assist-window-header");
    const form = ruleBody(css, ".apple-assist-window-form");
    const textarea = ruleBody(css, ".apple-assist-window-textarea");
    const feedback = ruleBody(css, ".apple-assist-window-feedback");
    const feedbackHeader = ruleBody(css, ".apple-assist-feedback-header");

    expect(shell).toMatch(/padding:\s*10px/);
    expect(shell).toMatch(/gap:\s*8px/);
    expect(shell).toMatch(/align-content:\s*start/);
    expect(header).toMatch(/padding-bottom:\s*8px/);
    expect(form).toMatch(/gap:\s*6px/);
    expect(textarea).toMatch(/min-height:\s*3\.4rem/);
    expect(textarea).toMatch(/max-height:\s*4\.6rem/);
    expect(feedback).toMatch(/height:\s*9\.5rem/);
    expect(feedbackHeader).toMatch(/border-bottom:\s*1px solid/);
  });

  it("keeps the feedback log scrollable instead of expanding the whole window", () => {
    const feedback = ruleBody(css, ".apple-assist-window-feedback");
    const body = ruleBody(css, ".apple-assist-feedback-body");
    const list = ruleBody(css, ".apple-assist-feedback-list");

    expect(feedback).toMatch(/overflow:\s*hidden/);
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(body).toMatch(/scrollbar-width:\s*thin/);
    expect(list).toMatch(/gap:\s*4px/);
  });

  it("separates multiple request groups inside the feedback log", () => {
    const groupStart = ruleBody(
      css,
      ".apple-assist-feedback-entry-group-start",
    );

    expect(groupStart).toMatch(/border-top:\s*1px solid/);
    expect(groupStart).toMatch(/margin-top:\s*3px/);
    expect(groupStart).toMatch(/padding-top:\s*6px/);
  });
});
