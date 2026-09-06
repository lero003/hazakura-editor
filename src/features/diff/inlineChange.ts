/** Linear, bounded change envelope. Multiple edits share one envelope; this
 * intentionally avoids a second quadratic diff inside each changed line. */
export type InlineChange = { prefix: string; removed: string; added: string; suffix: string };
type Segmenter = { segment: (text: string) => Iterable<{ segment: string }> };
type SegmenterConstructor = new (locale: undefined, options: { granularity: "grapheme" }) => Segmenter;
let segmenter: Segmenter | null | undefined;
function units(text: string): string[] {
  if (segmenter === undefined) {
    const Constructor = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
    segmenter = Constructor ? new Constructor(undefined, { granularity: "grapheme" }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}
export function describeInlineChange(before: string, after: string): InlineChange {
  if (before === after) return { prefix: before, removed: "", added: "", suffix: "" };
  if (before.length + after.length > 8000) return { prefix: "", removed: before, added: after, suffix: "" };
  const left = units(before); const right = units(after);
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start += 1;
  let leftEnd = left.length; let rightEnd = right.length;
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) { leftEnd -= 1; rightEnd -= 1; }
  return { prefix: left.slice(0, start).join(""), removed: left.slice(start, leftEnd).join(""),
    added: right.slice(start, rightEnd).join(""), suffix: left.slice(leftEnd).join("") };
}
