import type { EditorTab } from "../../types";

/**
 * 上部の「保存」が押せる条件（実機指摘）。
 *
 * 以前は「未保存の変更があるか」を見ていなかったため、保存済みの文書でも
 * 押せる見た目のままだった。保存は**未保存の変更があるとき**、または
 * **保存先がまだ無い文書（新規作成）**のとき押せる —— 空の新規文書は dirty では
 * ないが、保存処理側は path なしを Save As へ回すので、入口だけが閉じていると
 * 「新規作成したのに保存できない」になる（外部レビュー R7）。
 * 加えて、保存できない文書（未選択・画像表示）・レビュー面が本文を覆っている間・
 * 生成ロック中・保存処理中は押せない（既存の条件をそのまま含む）。
 * ※ 空の新規文書を dirty 扱いにはしない（閉じる確認や復旧の意味まで変わるため）。
 */
export function resolvePrimarySaveEnabled(state: {
  activeDirty: boolean;
  canNavigate: boolean;
  /** 保存先が未定（新規作成で、まだ名前が無い）。 */
  pathless: boolean;
  generationLocked: boolean;
  readingOverlayOpen: boolean;
  saveStatus: EditorTab["saveStatus"] | null;
}): boolean {
  if (!state.canNavigate) {
    return false;
  }
  if (!state.activeDirty && !state.pathless) {
    return false;
  }
  if (state.readingOverlayOpen || state.generationLocked) {
    return false;
  }
  return state.saveStatus !== "saving";
}
