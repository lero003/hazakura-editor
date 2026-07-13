import { useMemo } from "react";
import {
  MARKDOWN_OUTLINE_MAX_HEADINGS,
  type MarkdownHeading,
  type MarkdownHeadingContext,
  type MarkdownOutline,
} from "../../types";
import { findCurrentMarkdownHeading } from "../../lib/utils";
import {
  markdownStructureItems,
  parseMarkdownStructure,
} from "../../features/editor/markdownStructure";

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
  const documentStructure = useMemo(
    () => (hasActiveDocument ? parseMarkdownStructure(activeContents) : null),
    [activeContents, hasActiveDocument],
  );
  const documentOutline = useMemo(
    () => (documentStructure ? extractMarkdownOutline(documentStructure) : null),
    [documentStructure],
  );
  const allStructureItems = useMemo(
    () => (documentStructure ? markdownStructureItems(documentStructure) : []),
    [documentStructure],
  );
  const documentStructureItems = allStructureItems.slice(
    0,
    MARKDOWN_OUTLINE_MAX_HEADINGS,
  );
  const documentStructureTruncated =
    allStructureItems.length > MARKDOWN_OUTLINE_MAX_HEADINGS;
  const documentHeadings = documentOutline?.headings ?? [];
  const currentMarkdownHeading = useMemo(
    () => findCurrentMarkdownHeading(documentHeadings, selectionLine),
    [documentHeadings, selectionLine],
  );

  return {
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    documentStructureItems,
    documentStructureTruncated,
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

function extractMarkdownOutline(
  structure: ReturnType<typeof parseMarkdownStructure>,
): MarkdownOutline {
  const navigationHeadings = structure.headings.filter(
    (heading) => heading.navigationLabel !== null,
  );
  const truncated =
    navigationHeadings.length > MARKDOWN_OUTLINE_MAX_HEADINGS;
  const headings: MarkdownHeading[] = navigationHeadings
    .slice(0, MARKDOWN_OUTLINE_MAX_HEADINGS)
    .map((heading) => ({
      level: heading.level,
      line: heading.line,
      text: heading.navigationLabel as string,
    }));

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
