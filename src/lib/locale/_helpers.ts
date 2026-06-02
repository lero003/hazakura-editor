import type { MenuLanguage } from "../../types";

// Internal helpers shared by the per-area `lib/locale/*` copy
// accessors. Kept in their own file (underscore prefix) so the
// per-feature modules stay focused on their strings; nothing
// outside the locale layer imports from here.

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function formatSaveFailureMessage(): string {
  return (
    "Save failed. Your edits are still in the editor. " +
    "Fix the file or folder issue, then try saving again."
  );
}

function isKanaStyle(lang: MenuLanguage): boolean {
  return lang === "kana";
}

export { formatTimestamp, formatSaveFailureMessage, isKanaStyle };
