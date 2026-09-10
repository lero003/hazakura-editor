import { expect, it } from "vitest";
import { resolveSettingsCategoryIndex } from "./settingsCategoryRail";

const offsets = [0, 500, 1000, 1500];

it("keeps the first category while the top section is on screen", () => {
  expect(resolveSettingsCategoryIndex(offsets, 0)).toBe(0);
});

it("follows the heading that has passed the reading line", () => {
  expect(resolveSettingsCategoryIndex(offsets, 520)).toBe(1);
  expect(resolveSettingsCategoryIndex(offsets, 1200)).toBe(2);
});

it("keeps the last category active at the bottom of the body", () => {
  expect(resolveSettingsCategoryIndex(offsets, 9000)).toBe(3);
});

it("returns the last measurable category when scrollTop is clamped at the bottom", () => {
  // 実ブラウザ: scrollTop の上限は scrollHeight - clientHeight。
  const viewport = { clientHeight: 800, scrollHeight: 2100 }; // 上限 1300
  expect(resolveSettingsCategoryIndex(offsets, 1300, 80, viewport)).toBe(3);
  // 途中では読み位置のまま（末尾判定は最下部だけ）
  expect(resolveSettingsCategoryIndex(offsets, 900, 80, viewport)).toBe(1);
  expect(resolveSettingsCategoryIndex(offsets, 1200, 80, viewport)).toBe(2);
  expect(resolveSettingsCategoryIndex(offsets, 1299, 80, viewport)).toBe(3);
});

it("skips unmeasurable headings at the bottom too", () => {
  const viewport = { clientHeight: 500, scrollHeight: 1000 };
  expect(
    resolveSettingsCategoryIndex([0, 500, 1000, Number.NaN], 500, 80, viewport),
  ).toBe(2);
});

it("uses the threshold as a reading line in front of the heading top", () => {
  expect(resolveSettingsCategoryIndex(offsets, 500 - 1, 24)).toBe(1);
  expect(resolveSettingsCategoryIndex(offsets, 500 - 24, 24)).toBe(1);
  expect(resolveSettingsCategoryIndex(offsets, 500 - 25, 24)).toBe(0);
});

it("falls back to the first category when no offset is measurable", () => {
  expect(resolveSettingsCategoryIndex([], 0)).toBe(0);
  expect(resolveSettingsCategoryIndex([], 1200)).toBe(0);
});

it("keeps a clicked section current when it lands short of the top", () => {
  // 押下時の移動は見出し上端の16px手前。フォント読込などで着地が数十pxずれても、
  // 押した項目がそのまま現在地として残る幅を持たせる。
  expect(resolveSettingsCategoryIndex(offsets, 1500 - 16)).toBe(3);
  expect(resolveSettingsCategoryIndex(offsets, 1500 - 71)).toBe(3);
  expect(resolveSettingsCategoryIndex(offsets, 1500 - 200)).toBe(2);
});

it("skips unmeasurable headings without shifting the remaining indices", () => {
  expect(resolveSettingsCategoryIndex([0, Number.NaN, 1000, Number.NaN], 1200)).toBe(2);
  expect(resolveSettingsCategoryIndex([Number.NaN, 500, Number.NaN, 1500], 520)).toBe(1);
});
