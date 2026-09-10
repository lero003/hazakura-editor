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
