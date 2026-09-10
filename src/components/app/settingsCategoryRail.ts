/**
 * 設定本文の見出し位置から「今見ているカテゴリ」を1つ選ぶ。
 *
 * カテゴリナビは本文をその見出しへ送るだけの入口で、独立した選択状態を持たない。
 * 現在地は本文のスクロール位置から導出する（UI-A0 の「表示選択は既存状態から導出する」方針）。
 */

/**
 * 見出し上端より少し手前を「読んでいる行」として扱う。
 *
 * カテゴリ押下時の移動は見出しを上端の16px手前に置く。ただしフォント読込や折返しの変化で
 * 着地が数十pxずれることがあるため、その余裕を含めて見る（着地後も押した項目が現在地のまま残る）。
 */
export const SETTINGS_CATEGORY_READING_LINE = 80;

type Measurable = { getBoundingClientRect(): { top: number } };

/**
 * 各見出しの、本文スクロール領域内での上端位置を返す。
 * 測定できない見出しは NaN にし、`resolveSettingsCategoryIndex` が読み飛ばす。
 */
export function settingsCategoryOffsets(
  scroller: Measurable & { scrollTop: number },
  headings: readonly (Measurable | null)[],
): number[] {
  const scrollerTop = scroller.getBoundingClientRect().top;
  return headings.map((heading) =>
    heading
      ? heading.getBoundingClientRect().top - scrollerTop + scroller.scrollTop
      : Number.NaN,
  );
}

/** 末尾判定の遊び。scrollTop は scrollHeight - clientHeight で頭打ちになる。 */
const BOTTOM_EPSILON = 1;

/**
 * `scrollTop` の位置で読んでいる行を越えている最後の見出しを現在地とする。
 * どの見出しも越えていなければ先頭を返す。
 *
 * `threshold` は押下時の着地（見出し上端の16px手前）とレイアウトのずれを吸収できる幅が要る。
 *
 * `viewport` を渡すと、本文が最下部まで達しているときに最後の測定可能な見出しを現在地にする。
 * 実ブラウザの `scrollTop` は `scrollHeight - clientHeight` を超えられないため、
 * 短い最終セクションでは最終見出しが読み位置に届かず、最下部でも1つ前が current のままになる。
 */
export function resolveSettingsCategoryIndex(
  offsets: readonly number[],
  scrollTop: number,
  threshold: number = SETTINGS_CATEGORY_READING_LINE,
  viewport?: { clientHeight: number; scrollHeight: number },
): number {
  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  const readingLine = safeScrollTop + threshold;
  let activeIndex = 0;

  offsets.forEach((offset, index) => {
    if (Number.isFinite(offset) && offset <= readingLine) {
      activeIndex = index;
    }
  });

  if (
    viewport &&
    viewport.clientHeight > 0 &&
    safeScrollTop + viewport.clientHeight >= viewport.scrollHeight - BOTTOM_EPSILON
  ) {
    for (let index = offsets.length - 1; index >= 0; index -= 1) {
      if (Number.isFinite(offsets[index])) {
        return index;
      }
    }
  }

  return activeIndex;
}
