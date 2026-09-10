import type { MenuLanguage } from "../../types";

/**
 * 開始画面の「最近開いたフォルダ」に出す日時ラベル。
 *
 * 保存済みの openedAt だけを使い、今日・昨日は言葉で、それ以前は月日で示す。
 * サンプル日時を固定表示しない（画面01の実装指示）ため、値が無いときは null を返す。
 * 判定と整形の両方をローカル日付で行い、実行時刻に依存しない形で単体テストする。
 */
export function formatRecentOpenedAt(
  openedAt: number,
  language: MenuLanguage,
  now: number,
): string | null {
  if (!Number.isFinite(openedAt) || openedAt <= 0 || !Number.isFinite(now)) {
    return null;
  }

  const opened = new Date(openedAt);
  const today = new Date(now);
  const openedDay = Date.UTC(opened.getFullYear(), opened.getMonth(), opened.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysApart = Math.round((todayDay - openedDay) / 86_400_000);

  if (daysApart === 0) {
    return TODAY[language];
  }
  if (daysApart === 1) {
    return YESTERDAY[language];
  }

  if (language === "kana") {
    return `${opened.getMonth() + 1}がつ${opened.getDate()}にち`;
  }
  if (language === "en") {
    return `${EN_MONTHS[opened.getMonth()]} ${opened.getDate()}`;
  }
  return `${opened.getMonth() + 1}月${opened.getDate()}日`;
}

const TODAY: Record<MenuLanguage, string> = {
  en: "Today",
  ja: "今日",
  kana: "きょう",
};

const YESTERDAY: Record<MenuLanguage, string> = {
  en: "Yesterday",
  ja: "昨日",
  kana: "きのう",
};

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
