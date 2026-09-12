/**
 * プレビューの「いま見ている見出し」を決める。
 *
 * 編集面にはスクロール位置に応じた現在の見出し（アウトラインの現在地）があるが、
 * プレビューは独立してスクロールするので、紙の上端に出す目印は**プレビュー自身の
 * 位置**から求める必要がある。ここは DOM に触らない純関数にしてテストで固定する。
 *
 * @param sections 見出しのテキストと、スクロール領域の内容座標での上端
 * @param scrollTop 現在のスクロール量
 * @param tolerance 見出しの少し手前で切り替えるための余裕（px）
 * @returns 到達している最後の見出し。まだどの見出しにも達していなければ null
 *          （＝紙の先頭では何も出さない。情報を増やさないため）
 */
export function resolvePreviewSection(
  sections: ReadonlyArray<{ text: string; top: number }>,
  scrollTop: number,
  tolerance = 8,
): string | null {
  let current: string | null = null;
  for (const section of sections) {
    if (!section.text) continue;
    if (section.top <= scrollTop + tolerance) {
      current = section.text;
      continue;
    }
    break;
  }
  return current;
}
