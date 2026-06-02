import {
  DIFF_MAX_LINE_PRODUCT,
  type CompareViewState,
  type DiffLine,
} from "../../types";
import { normalizeTextLineEndings } from "../../lib/utils";

export function buildLineDiff(
  leftContents: string,
  rightContents: string,
): Pick<CompareViewState, "lines" | "additions" | "removals"> {
  const leftLines = splitDiffLines(leftContents);
  const rightLines = splitDiffLines(rightContents);
  const lineProduct = leftLines.length * rightLines.length;

  if (lineProduct > DIFF_MAX_LINE_PRODUCT) {
    throw new Error(
      "Compare stopped because these files are too large for the comparison preview.",
    );
  }

  const table: number[][] = Array.from(
    { length: leftLines.length + 1 },
    () => Array(rightLines.length + 1).fill(0),
  );

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightLines.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      table[leftIndex][rightIndex] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? table[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(
              table[leftIndex + 1][rightIndex],
              table[leftIndex][rightIndex + 1],
            );
    }
  }

  const lines: DiffLine[] = [];
  let additions = 0;
  let removals = 0;
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    if (
      leftIndex < leftLines.length &&
      rightIndex < rightLines.length &&
      leftLines[leftIndex] === rightLines[rightIndex]
    ) {
      lines.push({
        kind: "equal",
        leftLine: leftIndex + 1,
        rightLine: rightIndex + 1,
        text: leftLines[leftIndex],
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      rightIndex < rightLines.length &&
      (leftIndex >= leftLines.length ||
        table[leftIndex][rightIndex + 1] >= table[leftIndex + 1][rightIndex])
    ) {
      lines.push({
        kind: "added",
        leftLine: null,
        rightLine: rightIndex + 1,
        text: rightLines[rightIndex],
      });
      additions += 1;
      rightIndex += 1;
      continue;
    }

    lines.push({
      kind: "removed",
      leftLine: leftIndex + 1,
      rightLine: null,
      text: leftLines[leftIndex],
    });
    removals += 1;
    leftIndex += 1;
  }

  return { lines, additions, removals };
}

function splitDiffLines(contents: string): string[] {
  const normalizedContents = normalizeTextLineEndings(contents, "lf");

  if (normalizedContents.length === 0) {
    return [""];
  }

  const lines = normalizedContents.split("\n");

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

export function isComparableTextFile(path: string): boolean {
  const lowerName = fileNameFromPath(path).toLowerCase();
  const extension = lowerName.includes(".")
    ? lowerName.split(".").at(-1) ?? ""
    : "";

  if (
    [
      "md",
      "markdown",
      "mdown",
      "txt",
      "text",
      "log",
      "json",
      "jsonl",
      "yaml",
      "yml",
      "toml",
      "csv",
      "tsv",
      "css",
      "html",
      "xml",
      "ini",
      "conf",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "ts",
      "tsx",
    ].includes(extension)
  ) {
    return true;
  }

  return [
    ".editorconfig",
    ".env",
    ".gitignore",
    ".npmrc",
    "changelog",
    "license",
    "makefile",
    "readme",
    "todo",
  ].includes(lowerName);
}

function fileNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}
