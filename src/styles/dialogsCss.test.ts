/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogsCss = readFileSync(
  `${process.cwd()}/src/styles/dialogs.css`,
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    dialogsCss.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))
      ?.groups?.body ?? ""
  );
}

/**
 * 外部レビュー R2: 書き出しの枠。揃えるのは本文の最小高さではなく**外枠**の高さである。
 * 本文側に min-height を置くと、長い文書名でヘッダーが伸びたときにフッターが枠外へ出る
 * （960×640・240字名で 69.19px はみ出した、という指摘）。実機fixtureでの実測:
 * ヘッダー 77→182px・本文 397→292px（スクロール）・フッターは枠内のまま。
 */
describe("export settings frame (R2)", () => {
  it("fixes the outer frame height and lets only the body scroll", () => {
    const form = ruleBody(".export-settings-dialog .export-settings-form");
    expect(form).toMatch(/height:\s*min\(779px,\s*calc\(100dvh - 32px\)\)/);
    expect(form).toMatch(/min-height:\s*0/);
    // 本文の min-height で高さを揃える方式へ戻さない（戻すとフッターが押し出される）。
    expect(form).not.toMatch(/min-height:\s*min\(542px/);

    const body = ruleBody(".export-settings-body");
    expect(body).toMatch(/flex:\s*1 1 auto/);
    expect(body).toMatch(/min-height:\s*0/);
    expect(body).toMatch(/overflow:\s*auto/);
    expect(body).toMatch(/align-content:\s*start/);
    expect(body).not.toMatch(/min-height:\s*min\(/);
  });

  it("keeps every non-body row from shrinking", () => {
    for (const selector of [
      ".export-settings-header",
      ".export-format-nav",
      ".export-settings-footer",
    ]) {
      expect(ruleBody(selector), selector).toMatch(/flex:\s*0 0 auto/);
    }
  });
});

describe("settings dialog frame", () => {
  it("keeps the reference frame size of the settings window", () => {
    // モックの基準寸法 1100×752（C02）。低いウィンドウでは縮む。
    const frame = ruleBody(".preferences-dialog.settings-dialog");
    expect(frame).toMatch(/max-width:\s*1100px/);
    expect(frame).toMatch(/max-height:\s*min\(752px,\s*calc\(100dvh - 48px\)\)/);
    expect(frame).toMatch(/width:\s*min\(1100px,\s*calc\(100vw - 48px\)\)/);
  });

  it("keeps the settings rail at the reference width without icons", () => {
    // 横並び（レール）になるのは広い窓のレイアウト。最初の出現ではなくこのブロックを見る。
    const desktopIndex = dialogsCss.indexOf(
      "@media (min-width: 800px) and (min-height: 481px)",
    );
    expect(desktopIndex).toBeGreaterThan(-1);
    const desktopLayout = dialogsCss.slice(desktopIndex);
    expect(desktopLayout).toMatch(
      /\.settings-category-nav\s*{[^}]*width:\s*200px/s,
    );
    // 「アイコンを置かない」は DOM 側で検査する（SettingsCategoryRail.test.tsx）。
    // ここはレールの幅と横並びレイアウトの契約だけを見る。
    expect(desktopLayout).toMatch(/\.settings-category-nav button\s*{[^}]*min-height:\s*40px/s);
  });
});
