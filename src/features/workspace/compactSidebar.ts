/**
 * 狭いウィンドウでのサイドバーの畳み方（モック23）。
 *
 * 方針:
 * - 狭い幅では**表示上だけ**既定で畳む。利用者が保存した設定は書き換えない。
 * - 利用者が明示的に開閉したら、その選択を幅の既定より優先する。
 * - 幅が変わったら明示選択を解除し、新しい幅の既定へ戻す（広幅→狭幅→広幅で元に戻る）。
 */

/** これ以下の幅ではサイドバーを既定で畳む（既存の狭幅用メディアクエリと同じ 1100px）。 */
export const COMPACT_SIDEBAR_MAX_WIDTH = 1100;

/** 明示選択（null＝未選択）と幅の既定から、実際に畳むかを決める。 */
export function resolveSidebarCollapsed(
  userOverride: boolean | null,
  compactWidth: boolean,
): boolean {
  return userOverride ?? compactWidth;
}

/** 開閉操作の結果。いま見えている状態の反対を明示選択として記録する。 */
export function nextSidebarOverride(
  userOverride: boolean | null,
  compactWidth: boolean,
): boolean {
  return !resolveSidebarCollapsed(userOverride, compactWidth);
}

/** 幅の既定へ戻す（明示選択の解除）。 */
export function releasedSidebarOverride(): null {
  return null;
}
