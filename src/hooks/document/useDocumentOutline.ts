import { useMemo } from "react";
import {
  MARKDOWN_OUTLINE_MAX_HEADINGS,
  type MarkdownHeading,
  type MarkdownHeadingContext,
  type MarkdownOutline,
} from "../../types";
import {
  findCurrentMarkdownHeading,
  parseMarkdownHeadingLine,
} from "../../lib/utils";
import { findYamlFrontmatter } from "../../features/editor/markdownFrontmatter";

type UseDocumentOutlineOptions = {
  activeContents: string;
  hasActiveDocument: boolean;
  selectionLine: number;
};

export function useDocumentOutline({
  activeContents,
  hasActiveDocument,
  selectionLine,
}: UseDocumentOutlineOptions) {
  const documentOutline = useMemo(
    () => (hasActiveDocument ? extractMarkdownOutline(activeContents) : null),
    [activeContents, hasActiveDocument],
  );
  const documentHeadings = documentOutline?.headings ?? [];
  const currentMarkdownHeading = useMemo(
    () => findCurrentMarkdownHeading(documentHeadings, selectionLine),
    [documentHeadings, selectionLine],
  );

  return {
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
  };
}

export function useMarkdownHeadingContext(
  headings: MarkdownHeading[],
  line: number,
) {
  return useMemo(
    () => getMarkdownHeadingContext(headings, line),
    [headings, line],
  );
}

function extractMarkdownOutline(source: string): MarkdownOutline {
  const headings: MarkdownHeading[] = [];
  const lines = source.split(/\r\n|\n|\r/);
  const frontmatterEndLine = findYamlFrontmatter(source)?.endLine ?? 0;
  let fenceMarker: "`" | "~" | null = null;
  let truncated = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (index + 1 <= frontmatterEndLine) {
      continue;
    }

    const line = lines[index];
    const trimmedStart = line.trimStart();
    const fenceMatch = trimmedStart.match(/^(```+|~~~+)/);

    if (fenceMatch) {
      const marker = fenceMatch[1].startsWith("`") ? "`" : "~";

      if (fenceMarker === marker) {
        fenceMarker = null;
      } else if (fenceMarker === null) {
        fenceMarker = marker;
      }

      continue;
    }

    if (fenceMarker !== null) {
      continue;
    }

    const heading = parseMarkdownHeadingLine(line, index + 1);

    if (heading) {
      if (headings.length < MARKDOWN_OUTLINE_MAX_HEADINGS) {
        headings.push(heading);
      } else {
        truncated = true;
        break;
      }
    }
  }

  return {
    headings,
    truncated,
  };
}

function getMarkdownHeadingContext(
  headings: MarkdownHeading[],
  line: number,
): MarkdownHeadingContext {
  let currentIndex = -1;

  for (let index = 0; index < headings.length; index += 1) {
    if (headings[index].line > line) {
      break;
    }

    currentIndex = index;
  }

  return {
    previous: currentIndex > 0 ? headings[currentIndex - 1] : null,
    current: currentIndex >= 0 ? headings[currentIndex] : null,
    next:
      currentIndex >= 0 && currentIndex + 1 < headings.length
        ? headings[currentIndex + 1]
        : currentIndex < 0
          ? headings[0] ?? null
          : null,
  };
}

export function clampScrollRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  return Math.min(Math.max(ratio, 0), 1);
}
