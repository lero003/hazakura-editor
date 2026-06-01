import type {
  CompareCase,
  CompareViewState,
  DiffDisplayRow,
  DiffLine,
  DiffSplitRow,
  MarkdownHeading,
  MenuLanguage,
} from "../types";
import {
  findCurrentMarkdownHeading,
  isMarkdownDocumentPath,
  parseMarkdownHeadingLine,
} from "../utils";

export function DiffBody({
  compareCase,
  menuLanguage,
  view,
}: {
  compareCase: CompareCase;
  menuLanguage: MenuLanguage;
  view: CompareViewState;
}) {
  const rows = buildDiffDisplayRows(
    compareCase,
    view,
    buildSplitDiffRows(view.lines),
    menuLanguage,
  );

  if (rows.length === 0) {
    return <div className="diff-empty">{emptyLabel(menuLanguage)}</div>;
  }

  return (
    <>
      {rows.map((displayRow) =>
        displayRow.kind === "section" ? (
          <div
            className="diff-section-row"
            key={displayRow.key}
            role="row"
          >
            <span role="cell">{displayRow.label}</span>
          </div>
        ) : (
          <div
            className={`diff-split-row ${displayRow.row.kind}`}
            key={displayRow.key}
            role="row"
          >
            <span className={`diff-line-number ${displayRow.row.left.kind}`}>
              {displayRow.row.left.line ?? ""}
            </span>
            <code className={`diff-cell ${displayRow.row.left.kind}`}>
              {displayRow.row.left.kind === "removed" ? (
                <span className="diff-cell-marker" aria-hidden="true">
                  -
                </span>
              ) : null}
              {displayRow.row.left.text || " "}
            </code>
            <span className={`diff-line-number ${displayRow.row.right.kind}`}>
              {displayRow.row.right.line ?? ""}
            </span>
            <code className={`diff-cell ${displayRow.row.right.kind}`}>
              {displayRow.row.right.kind === "added" ? (
                <span className="diff-cell-marker" aria-hidden="true">
                  +
                </span>
              ) : null}
              {displayRow.row.right.text || " "}
            </code>
          </div>
        ),
      )}
    </>
  );
}

function emptyLabel(menuLanguage: MenuLanguage): string {
  return menuLanguage !== "en" ? "差分はありません" : "No differences";
}

function buildSplitDiffRows(lines: DiffLine[]): DiffSplitRow[] {
  const rows: DiffSplitRow[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.kind === "equal") {
      rows.push({
        kind: "equal",
        left: {
          kind: "equal",
          line: line.leftLine,
          text: line.text,
        },
        right: {
          kind: "equal",
          line: line.rightLine,
          text: line.text,
        },
      });
      index += 1;
      continue;
    }

    const removedLines: DiffLine[] = [];
    const addedLines: DiffLine[] = [];

    while (index < lines.length && lines[index].kind !== "equal") {
      if (lines[index].kind === "removed") {
        removedLines.push(lines[index]);
      } else {
        addedLines.push(lines[index]);
      }
      index += 1;
    }

    const rowCount = Math.max(removedLines.length, addedLines.length);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const removed = removedLines[rowIndex];
      const added = addedLines[rowIndex];

      rows.push({
        kind:
          removed && added
            ? "changed"
            : removed
              ? "removed"
              : "added",
        left: removed
          ? {
              kind: "removed",
              line: removed.leftLine,
              text: removed.text,
            }
          : {
              kind: "blank",
              line: null,
              text: "",
            },
        right: added
          ? {
              kind: "added",
              line: added.rightLine,
              text: added.text,
            }
          : {
              kind: "blank",
              line: null,
              text: "",
            },
      });
    }
  }

  return rows;
}

function buildDiffDisplayRows(
  compareCase: CompareCase,
  view: CompareViewState,
  rows: DiffSplitRow[],
  menuLanguage: MenuLanguage,
): DiffDisplayRow[] {
  const { left: leftPath, right: rightPath } = getCaseSidePaths(compareCase);
  if (!isMarkdownDocumentPath(leftPath) && !isMarkdownDocumentPath(rightPath)) {
    return rows.map((row, index) => ({
      kind: "line",
      key: diffRowKey(row, index),
      row,
    }));
  }

  const leftHeadings = collectDiffSideMarkdownHeadings(view, "left");
  const rightHeadings = collectDiffSideMarkdownHeadings(view, "right");
  const displayRows: DiffDisplayRow[] = [];
  let inChangedBlock = false;

  rows.forEach((row, index) => {
    if (row.kind === "equal") {
      inChangedBlock = false;
      displayRows.push({
        kind: "line",
        key: diffRowKey(row, index),
        row,
      });
      return;
    }

    if (!inChangedBlock) {
      const label = formatDiffSectionContext(
        row,
        leftHeadings,
        rightHeadings,
        menuLanguage,
      );

      if (label) {
        displayRows.push({
          kind: "section",
          key: `section-${index}-${row.left.line ?? "x"}-${row.right.line ?? "x"}`,
          label,
        });
      }

      inChangedBlock = true;
    }

    displayRows.push({
      kind: "line",
      key: diffRowKey(row, index),
      row,
    });
  });

  return displayRows;
}

function getCaseSidePaths(compareCase: CompareCase): {
  left: string;
  right: string;
} {
  switch (compareCase.kind) {
    case "file":
      return { left: compareCase.leftPath, right: compareCase.rightPath };
    case "changes":
      return {
        left: compareCase.documentPath,
        right: compareCase.documentPath,
      };
    case "candidate":
      return {
        left: compareCase.documentPath,
        right: compareCase.documentPath,
      };
  }
}

function diffRowKey(row: DiffSplitRow, index: number): string {
  return `${row.kind}-${index}-${row.left.line ?? "x"}-${row.right.line ?? "x"}`;
}

function collectDiffSideMarkdownHeadings(
  view: CompareViewState,
  side: "left" | "right",
): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let fenceMarker: "`" | "~" | null = null;

  for (const line of view.lines) {
    const lineNumber = side === "left" ? line.leftLine : line.rightLine;

    if (lineNumber === null) {
      continue;
    }

    const trimmedStart = line.text.trimStart();
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

    const heading = parseMarkdownHeadingLine(line.text, lineNumber);

    if (heading) {
      headings.push(heading);
    }
  }

  return headings;
}

function formatDiffSectionContext(
  row: DiffSplitRow,
  leftHeadings: MarkdownHeading[],
  rightHeadings: MarkdownHeading[],
  menuLanguage: MenuLanguage,
): string | null {
  const leftHeading = row.left.line
    ? findCurrentMarkdownHeading(leftHeadings, row.left.line)
    : null;
  const rightHeading = row.right.line
    ? findCurrentMarkdownHeading(rightHeadings, row.right.line)
    : null;

  if (!leftHeading && !rightHeading) {
    return null;
  }

  const leftText = leftHeading?.text ?? null;
  const rightText = rightHeading?.text ?? null;

  if (leftText && rightText && leftText !== rightText) {
    return menuLanguage !== "en"
      ? `変更位置: 比較元 § ${leftText} / 比較先 § ${rightText}`
      : `Changed in: source § ${leftText} / target § ${rightText}`;
  }

  return menuLanguage !== "en"
    ? `変更位置: § ${leftText ?? rightText}`
    : `Changed in: § ${leftText ?? rightText}`;
}
