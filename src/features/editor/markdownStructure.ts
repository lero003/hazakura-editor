import {
  findYamlFrontmatter,
  type MarkdownFrontmatterRange,
} from "./markdownFrontmatter";

const FENCE_MIN_LENGTH = 3;

export type MarkdownStructureHeading = {
  kind: "heading";
  level: number;
  line: number;
  startOffset: number;
  endOffset: number;
  text: string;
  /** Empty headings remain structural but are not navigation candidates. */
  navigationLabel: string | null;
};

export type MarkdownStructurePageBreak = {
  kind: "page-break";
  line: number;
  startOffset: number;
  contentEndOffset: number;
  endOffset: number;
  /** A trailing marker is removed from rendered reading/export output. */
  role: "page-break" | "drop";
};

export type MarkdownStructureItem =
  | MarkdownStructureHeading
  | MarkdownStructurePageBreak;

export type MarkdownStructure = {
  frontmatter: MarkdownFrontmatterRange | null;
  headings: MarkdownStructureHeading[];
  pageBreaks: MarkdownStructurePageBreak[];
};

export function markdownStructureItems(
  structure: MarkdownStructure,
): MarkdownStructureItem[] {
  return [...structure.headings, ...structure.pageBreaks].sort(
    (left, right) => left.startOffset - right.startOffset,
  );
}

type SourceLine = {
  line: number;
  startOffset: number;
  contentEndOffset: number;
  endOffset: number;
  text: string;
};

type FenceMatch = {
  char: "`" | "~";
  length: number;
  remainder: string;
};

/**
 * Read one Markdown source into the structure shared by Outline, e-book, and
 * EPUB navigation. The result is interpretation only: offsets point into the
 * canonical source and no text is normalized or rewritten.
 */
export function parseMarkdownStructure(source: string): MarkdownStructure {
  const frontmatter = findYamlFrontmatter(source);
  const lines = sourceLines(source);
  const headings: MarkdownStructureHeading[] = [];
  const pageBreakCandidateIndexes: number[] = [];
  let fenceChar: "`" | "~" | null = null;
  let fenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (frontmatter && line.startOffset < frontmatter.bodyOffset) {
      continue;
    }

    const fence = matchFence(line.text);
    if (fence) {
      if (fenceChar === null) {
        fenceChar = fence.char;
        fenceLength = fence.length;
      } else if (
        fence.char === fenceChar &&
        fence.length >= fenceLength &&
        /^[ \t]*$/.test(fence.remainder)
      ) {
        fenceChar = null;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceChar !== null) {
      continue;
    }

    const heading = matchAtxHeading(line.text);
    if (heading) {
      headings.push({
        kind: "heading",
        level: heading.level,
        line: line.line,
        startOffset: line.startOffset,
        endOffset: line.contentEndOffset,
        text: heading.text,
        navigationLabel: heading.text.length > 0 ? heading.text : null,
      });
    }

    const marker = line.text.trim();
    if (marker === "---" || marker === "===") {
      pageBreakCandidateIndexes.push(index);
    }
  }

  const pageBreaks = pageBreakCandidateIndexes.flatMap((index) => {
    const role = classifyPageBreak(lines, index);
    if (!role) {
      return [];
    }
    const line = lines[index];
    return [
      {
        kind: "page-break" as const,
        line: line.line,
        startOffset: line.startOffset,
        contentEndOffset: line.contentEndOffset,
        endOffset: line.endOffset,
        role,
      },
    ];
  });

  return { frontmatter, headings, pageBreaks };
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let startOffset = 0;
  let line = 1;

  while (startOffset < source.length) {
    const newlineOffset = source.indexOf("\n", startOffset);
    const rawContentEnd =
      newlineOffset === -1 ? source.length : newlineOffset;
    const contentEndOffset =
      rawContentEnd > startOffset && source[rawContentEnd - 1] === "\r"
        ? rawContentEnd - 1
        : rawContentEnd;
    const endOffset =
      newlineOffset === -1 ? source.length : newlineOffset + 1;
    lines.push({
      line,
      startOffset,
      contentEndOffset,
      endOffset,
      text: source.slice(startOffset, contentEndOffset),
    });
    startOffset = endOffset;
    line += 1;
  }

  return lines;
}

function matchAtxHeading(
  line: string,
): { level: number; text: string } | null {
  const match = /^(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    level: match[1].length,
    text: (match[2] ?? "").replace(/[ \t]+#*[ \t]*$/, "").trim(),
  };
}

function matchFence(line: string): FenceMatch | null {
  const match = /^[ \t]{0,3}([`~])(\1*)/.exec(line);
  if (!match) {
    return null;
  }
  const length = match[1].length + (match[2]?.length ?? 0);
  if (length < FENCE_MIN_LENGTH) {
    return null;
  }
  return {
    char: match[1] as "`" | "~",
    length,
    remainder: line.slice(match[0].length),
  };
}

function classifyPageBreak(
  lines: SourceLine[],
  index: number,
): MarkdownStructurePageBreak["role"] | null {
  const previous = lines[index - 1]?.text.trim() ?? null;
  const next = lines[index + 1]?.text.trim() ?? "";
  if (previous !== "" || next !== "") {
    return null;
  }
  const hasFollowingContent = lines
    .slice(index + 1)
    .some((line) => line.text.trim() !== "");
  return hasFollowingContent ? "page-break" : "drop";
}
