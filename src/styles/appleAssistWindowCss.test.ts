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

  it("anchors the composer around one flexible scrolling conversation", () => {
    const shell = ruleBody(css, ".apple-assist-window-shell");
    expect(shell).toMatch(/grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
    expect(shell).toMatch(/overflow:\s*hidden/);
    const chat = ruleBody(css, ".apple-assist-chat");
    expect(chat).toMatch(/min-height:\s*0/);
    expect(chat).toMatch(/overflow-y:\s*auto/);
  });

  it("contains proposal rows and wraps the change summary at narrow widths", () => {
    const row = ruleBody(css, ".apple-assist-proposal-row");
    const cellText = ruleBody(css, ".apple-assist-proposal-cell > span:last-child");
    const narrowMedia = css.match(
      /@media\s*\(max-width:\s*520px\)\s*{(?<body>[\s\S]*)}\s*$/,
    )?.groups?.body ?? "";

    expect(row).toMatch(/min-width:\s*0/);
    expect(cellText).toMatch(/min-width:\s*0/);
    expect(narrowMedia).toMatch(
      /\.apple-assist-proposal-columns\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)/,
    );
    expect(narrowMedia).toMatch(
      /\.apple-assist-proposal-summary\s*{[\s\S]*grid-column:\s*1\s*\/\s*-1[\s\S]*overflow-wrap:\s*anywhere[\s\S]*white-space:\s*normal/,
    );
    expect(narrowMedia).toMatch(
      /\.apple-assist-proposal-line-number\s*{[\s\S]*flex-basis:\s*1\.5rem/,
    );
  });

  it("uses readable label sizes and a multiline resizable request field", () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    const textarea = ruleBody(css, ".apple-assist-window-textarea");
    expect(textarea).toMatch(/min-height:\s*5rem/);
    expect(textarea).toMatch(/resize:\s*vertical/);
  });

  it("keeps the request field pinned while only the conversation scrolls", () => {
    // モック06の指示6: 入力は下端固定・会話のみスクロール。
    // フォーム自体を max-height + overflow でスクロールさせない。
    // 同じセレクタが複数あるので、フォームの全ルールを対象にする。
    const formRules = [...css.matchAll(/\.apple-assist-window-form\s*{[^}]*}/g)].map((match) => match[0]);
    expect(formRules.length).toBeGreaterThan(0);
    for (const rule of formRules) {
      expect(rule).not.toMatch(/max-height/);
      expect(rule).not.toMatch(/45vh/);
    }
    expect(formRules.some((rule) => /overflow:\s*visible/.test(rule))).toBe(true);
    expect(ruleBody(css, ".apple-assist-chat")).toMatch(/overflow-y:\s*auto/);
  });

  it("does not reserve a duplicate in-window product title", () => {
    expect(css).not.toContain(".apple-assist-window-title");
  });

  it("uses flat helper backgrounds for special themes instead of inheriting app-shell gradients", () => {
    const edohiganShell = ruleBody(
      css,
      ':root[data-theme="edohigan"] .apple-assist-window-shell',
    );
    const shokouShell = ruleBody(
      css,
      ':root[data-theme="shokou"] .apple-assist-window-shell',
    );
    const yakouShell = ruleBody(
      css,
      ':root[data-theme="yakou"] .apple-assist-window-shell',
    );
    const crtShell = ruleBody(
      css,
      ':root[data-theme="crt"] .apple-assist-window-shell',
    );
    const shinkaiShell = ruleBody(
      css,
      ':root[data-theme="shinkai"] .apple-assist-window-shell',
    );

    expect(edohiganShell).toMatch(/background:\s*#322438/);
    expect(shokouShell).toMatch(/background:\s*#eef5fb/);
    expect(yakouShell).toMatch(/background:\s*#14141e/);
    expect(crtShell).toMatch(/background:\s*#08120c/);
    expect(shinkaiShell).toMatch(/background:\s*#0f3548/);
    for (const shell of [
      edohiganShell,
      shokouShell,
      yakouShell,
      crtShell,
      shinkaiShell,
    ]) {
      expect(shell).not.toMatch(/gradient/);
    }
  });

  it("keeps the request textarea on a flat surface instead of inheriting theme gradients", () => {
    const textarea = ruleBody(css, ".apple-assist-window-textarea");

    expect(textarea).toMatch(
      /background:\s*var\(--surface-strong,\s*var\(--surface,\s*var\(--bg\)\)\)/,
    );
    expect(textarea).not.toMatch(/background:\s*var\(--bg-input,\s*var\(--bg\)\)/);
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

  it("keeps cancellation feedback neutral instead of styling it as a failure", () => {
    const cancelled = ruleBody(
      css,
      ".apple-assist-feedback-entry-kind-cancelled",
    );

    expect(cancelled).toMatch(/color:\s*var\(--text-muted\)/);
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

  it("keeps the pinned conversation state and request history bounded", () => {
    const state = ruleBody(css, ".apple-assist-conversation-state");
    const button = ruleBody(css, ".apple-assist-window-new-conversation");
    const history = ruleBody(css, ".apple-assist-conversation-history");

    expect(state).toMatch(/display:\s*flex/);
    expect(button).toMatch(/white-space:\s*nowrap/);
    expect(history).toMatch(/max-height:\s*5\.5rem/);
    expect(history).toMatch(/overflow-y:\s*auto/);
  });
});
