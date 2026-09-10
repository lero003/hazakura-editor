import { expect, it } from "vitest";
import { formatRecentOpenedAt } from "./recentOpenedAtLabel";

// 固定の「今」を使い、実行時刻に依存させない。
const now = new Date(2026, 8, 10, 15, 0, 0).getTime(); // 2026-09-10 15:00 ローカル
const today = new Date(2026, 8, 10, 9, 30, 0).getTime();
const yesterday = new Date(2026, 8, 9, 22, 0, 0).getTime();
const older = new Date(2026, 8, 7, 12, 0, 0).getTime();

it("labels today and yesterday per language", () => {
  expect(formatRecentOpenedAt(today, "ja", now)).toBe("今日");
  expect(formatRecentOpenedAt(today, "en", now)).toBe("Today");
  expect(formatRecentOpenedAt(today, "kana", now)).toBe("きょう");
  expect(formatRecentOpenedAt(yesterday, "ja", now)).toBe("昨日");
  expect(formatRecentOpenedAt(yesterday, "en", now)).toBe("Yesterday");
  expect(formatRecentOpenedAt(yesterday, "kana", now)).toBe("きのう");
});

it("falls back to a month and day for older folders", () => {
  expect(formatRecentOpenedAt(older, "ja", now)).toBe("9月7日");
  expect(formatRecentOpenedAt(older, "kana", now)).toBe("9がつ7にち");
  expect(formatRecentOpenedAt(older, "en", now)).toBe("Sep 7");
});

it("treats midnight boundaries by local calendar day", () => {
  const lateYesterday = new Date(2026, 8, 9, 23, 59, 0).getTime();
  const earlyToday = new Date(2026, 8, 10, 0, 1, 0).getTime();
  expect(formatRecentOpenedAt(lateYesterday, "ja", now)).toBe("昨日");
  expect(formatRecentOpenedAt(earlyToday, "ja", now)).toBe("今日");
});

it("returns null when the timestamp cannot be trusted", () => {
  expect(formatRecentOpenedAt(0, "ja", now)).toBeNull();
  expect(formatRecentOpenedAt(Number.NaN, "ja", now)).toBeNull();
  expect(formatRecentOpenedAt(-1, "ja", now)).toBeNull();
});
