/**
 * Soft shape checks for reserved OKF index.md / log.md files.
 * Hard failures are intentionally avoided for reserved shape (design matrix).
 */

export type OkfIndexShapeAdvice = {
  code: "index-shape";
  message: string;
} | null;

export type OkfLogShapeAdvice = {
  code: "log-shape";
  message: string;
} | null;

const DATE_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;

/**
 * Index body advice: empty, no headings, or no list entries → advice only.
 */
export function adviseIndexShape(body: string): OkfIndexShapeAdvice {
  const trimmed = body.trim();
  if (!trimmed) {
    return {
      code: "index-shape",
      message: "index.md is empty; progressive disclosure lists are recommended.",
    };
  }

  const hasHeading = /^#\s+\S/m.test(trimmed);
  const hasListItem = /^[\t ]*[-*+]\s+\S/m.test(trimmed);

  if (!hasHeading && !hasListItem) {
    return {
      code: "index-shape",
      message:
        "index.md has no section headings or list entries; directory listing shape is recommended.",
    };
  }

  if (!hasListItem) {
    return {
      code: "index-shape",
      message:
        "index.md has no list entries; concept and subdirectory links are recommended.",
    };
  }

  return null;
}

/**
 * Log body advice: missing ISO date headings or non-descending date order.
 */
export function adviseLogShape(body: string): OkfLogShapeAdvice {
  const trimmed = body.trim();
  if (!trimmed) {
    return {
      code: "log-shape",
      message: "log.md is empty; date-grouped update entries are recommended.",
    };
  }

  const dates: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const match = DATE_HEADING_RE.exec(line.trim());
    if (match?.[1]) {
      dates.push(match[1]);
    }
  }

  if (dates.length === 0) {
    return {
      code: "log-shape",
      message:
        "log.md has no `## YYYY-MM-DD` date headings; chronological update history is recommended.",
    };
  }

  for (let i = 1; i < dates.length; i += 1) {
    const prev = dates[i - 1] ?? "";
    const current = dates[i] ?? "";
    // Newest first: each subsequent date should be <= previous.
    if (current > prev) {
      return {
        code: "log-shape",
        message:
          "log.md date headings are not in newest-first order; chronological reverse order is recommended.",
      };
    }
  }

  return null;
}
