import type { MenuLanguage } from "../../types";
export function backupReviewCopy(language: MenuLanguage) {
  if (language === "kana") return {
    stale: "ふみや へんしゅうが かわりました。ばっくあっぷを もういちど くらべてください。",
    unavailable: "いまは はんえいできません。にゅうりょくや しょりを おえてから ためしてください。",
    applied: "ばっくあっぷを はんえいしました（みほぞん）。⌘Zで もどせます。",
    failed: "ばっくあっぷを よみこめませんでした。",
  };
  if (language === "ja") return {
    stale: "文書や編集内容が比較後に変更されました。バックアップをもう一度比較してください。",
    unavailable: "現在は反映できません。入力や処理が終わってから試してください。",
    applied: "バックアップを反映しました（未保存）。⌘Zで戻せます。",
    failed: "バックアップを読み込めませんでした。",
  };
  return { stale: "The document or edits changed after comparison. Compare the backup again.",
    unavailable: "Cannot apply now. Finish the current input or operation and try again.",
    applied: "Backup applied (unsaved). Use ⌘Z to undo.", failed: "Could not read the backup." };
}
