export type MarkdownFrontmatterRange = {
  bodyOffset: number;
  endLine: number;
};

export function findYamlFrontmatter(
  source: string,
): MarkdownFrontmatterRange | null {
  const firstLineEnd = source.indexOf("\n");
  const firstLine =
    firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  if (firstLine.trim() !== "---") {
    return null;
  }

  let lineStart = firstLineEnd === -1 ? source.length : firstLineEnd + 1;
  let lineNumber = 2;
  while (lineStart < source.length) {
    const lineEnd = source.indexOf("\n", lineStart);
    const effectiveLineEnd = lineEnd === -1 ? source.length : lineEnd;
    const line = source.slice(lineStart, effectiveLineEnd);
    if (line.trim() === "---") {
      return {
        bodyOffset: lineEnd === -1 ? source.length : lineEnd + 1,
        endLine: lineNumber,
      };
    }
    lineStart = lineEnd === -1 ? source.length : lineEnd + 1;
    lineNumber += 1;
  }

  return null;
}

export function stripYamlFrontmatter(source: string): string {
  const frontmatter = findYamlFrontmatter(source);
  return frontmatter ? source.slice(frontmatter.bodyOffset) : source;
}
