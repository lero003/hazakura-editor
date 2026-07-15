/**
 * UI-only presentation helpers for the OKF review surface.
 * Does not scan disk or re-interpret YAML — only reshapes an existing result.
 */

import type { OkfReviewFinding, OkfReviewResult } from "./types";

export type OkfSurfaceFolderKind = "empty" | "plain-markdown" | "okf-like";

export type OkfSurfacePresentation = {
  folderKind: OkfSurfaceFolderKind;
  /** Failures users should act on first (stable order from the model). */
  priorityFindings: OkfReviewFinding[];
  /** Advice / info that is safe to ignore for ordinary writing. */
  optionalFindings: OkfReviewFinding[];
  failureCount: number;
  optionalCount: number;
  hasNoIssues: boolean;
};

const DEFAULT_PRIORITY_LIMIT = 5;
const DEFAULT_OPTIONAL_LIMIT = 5;

/**
 * Heuristic folder framing for human status copy.
 * Never claims formal OKF certification.
 */
export function classifyOkfFolderKind(
  result: OkfReviewResult,
): OkfSurfaceFolderKind {
  if (result.files.length === 0) {
    return "empty";
  }

  const { summary } = result;
  const hasTypedConcept = result.files.some(
    (file) => file.kind === "concept" && file.type != null && file.type !== "",
  );
  const looksOkfLike =
    summary.hasRootIndex ||
    summary.declaredOkfVersion != null ||
    summary.logCount > 0 ||
    hasTypedConcept;

  return looksOkfLike ? "okf-like" : "plain-markdown";
}

export function presentOkfReviewSurface(
  result: OkfReviewResult,
  options?: {
    priorityLimit?: number;
    optionalLimit?: number;
  },
): OkfSurfacePresentation {
  const priorityLimit = options?.priorityLimit ?? DEFAULT_PRIORITY_LIMIT;
  const optionalLimit = options?.optionalLimit ?? DEFAULT_OPTIONAL_LIMIT;

  const priorityFindings = result.findings
    .filter((finding) => finding.severity === "failure")
    .slice(0, priorityLimit);
  const optionalFindings = result.findings
    .filter((finding) => finding.severity !== "failure")
    .slice(0, optionalLimit);

  const failureCount = result.summary.failureCount;
  const optionalCount = result.findings.filter(
    (finding) => finding.severity !== "failure",
  ).length;

  return {
    folderKind: classifyOkfFolderKind(result),
    priorityFindings,
    optionalFindings,
    failureCount,
    optionalCount,
    hasNoIssues: failureCount === 0 && optionalCount === 0,
  };
}
