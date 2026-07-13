import {
  parseMarkdownStructure,
  type MarkdownStructure,
} from "./markdownStructure";

export const LONG_SECTION_LINE_THRESHOLD = 800;
export const LONG_SECTION_CHARACTER_THRESHOLD = 40_000;

export type MarkdownStructureAdvisory =
  | {
      kind: "skipped-level";
      line: number;
      previousLevel: number;
      level: number;
    }
  | {
      kind: "empty-heading";
      line: number;
    }
  | {
      kind: "duplicate-navigation-label";
      line: number;
      firstLine: number;
      label: string;
    }
  | {
      kind: "long-section";
      line: number;
      lineCount: number;
      characterCount: number;
    };

/**
 * Produces non-blocking structure suggestions. It never changes source and is
 * intentionally disconnected from save and export decisions.
 */
export function analyzeMarkdownStructure(
  source: string,
  structure: MarkdownStructure = parseMarkdownStructure(source),
): MarkdownStructureAdvisory[] {
  const advisories: MarkdownStructureAdvisory[] = [];
  const firstNavigationLineByLabel = new Map<string, number>();

  for (let index = 0; index < structure.headings.length; index += 1) {
    const heading = structure.headings[index];
    const previous = structure.headings[index - 1];
    const next = structure.headings[index + 1];

    if (previous && heading.level > previous.level + 1) {
      advisories.push({
        kind: "skipped-level",
        line: heading.line,
        previousLevel: previous.level,
        level: heading.level,
      });
    }

    if (heading.navigationLabel === null) {
      advisories.push({ kind: "empty-heading", line: heading.line });
    } else {
      const key = heading.navigationLabel.toLocaleLowerCase();
      const firstLine = firstNavigationLineByLabel.get(key);
      if (firstLine === undefined) {
        firstNavigationLineByLabel.set(key, heading.line);
      } else {
        advisories.push({
          kind: "duplicate-navigation-label",
          line: heading.line,
          firstLine,
          label: heading.navigationLabel,
        });
      }
    }

    const sectionEndOffset = next?.startOffset ?? source.length;
    const lineCount = (next?.line ?? sourceLineCount(source) + 1) - heading.line;
    const characterCount = sectionEndOffset - heading.startOffset;
    if (
      lineCount >= LONG_SECTION_LINE_THRESHOLD ||
      characterCount >= LONG_SECTION_CHARACTER_THRESHOLD
    ) {
      advisories.push({
        kind: "long-section",
        line: heading.line,
        lineCount,
        characterCount,
      });
    }
  }

  return advisories;
}

function sourceLineCount(source: string): number {
  if (source.length === 0) {
    return 1;
  }
  let lines = 1;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      lines += 1;
    }
  }
  return lines;
}
