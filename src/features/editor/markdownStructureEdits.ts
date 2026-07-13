import type { MarkdownStructureHeading } from "./markdownStructure";

export type HeadingLevelChangeDirection = "promote" | "demote";

export type MarkdownSourceChange = {
  from: number;
  to: number;
  insert: string;
  nextLevel: number;
};

/**
 * Builds the one source change needed for an explicit heading-level edit.
 * The current source is revalidated so stale Outline offsets cannot rewrite
 * unrelated text.
 */
export function buildHeadingLevelChange(
  source: string,
  heading: MarkdownStructureHeading,
  direction: HeadingLevelChangeDirection,
): MarkdownSourceChange | null {
  const nextLevel =
    direction === "promote" ? heading.level - 1 : heading.level + 1;
  if (nextLevel < 1 || nextLevel > 6) {
    return null;
  }

  const lineSource = source.slice(heading.startOffset, heading.endOffset);
  const marker = /^(#{1,6})(?=[ \t]|$)/.exec(lineSource)?.[1] ?? null;
  if (!marker || marker.length !== heading.level) {
    return null;
  }

  return {
    from: heading.startOffset,
    to: heading.startOffset + marker.length,
    insert: "#".repeat(nextLevel),
    nextLevel,
  };
}
