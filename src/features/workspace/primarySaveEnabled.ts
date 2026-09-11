import type { EditorTab } from "../../types";

/**
 * 上部の「保存」が押せる条件（実機指摘）。
 *
 * 以前は「未保存の変更があるか」を見ていなかったため、保存済みの文書でも
 * 押せる見た目のままだった。保存は**未保存の変更があるときだけ**押せる。
 * 加えて、保存できない文書（未選択・画像表示）・レビュー面が本文を覆っている間・
 * 生成ロック中・保存処理中は押せない（既存の条件をそのまま含む）。
 */
export function resolvePrimarySaveEnabled(state: {
  activeDirty: boolean;
  canNavigate: boolean;
  generationLocked: boolean;
  readingOverlayOpen: boolean;
  saveStatus: EditorTab["saveStatus"] | null;
}): boolean {
  if (!state.canNavigate || !state.activeDirty) {
    return false;
  }
  if (state.readingOverlayOpen || state.generationLocked) {
    return false;
  }
  return state.saveStatus !== "saving";
}
