/**
 * UI-only presentation helpers for the OKF review surface.
 * Does not scan disk or re-interpret YAML — only reshapes an existing result.
 */

import type { OkfReviewFinding, OkfReviewResult } from "./types";

export type OkfSurfaceFolderKind = "empty" | "plain-markdown" | "okf-like";

export type OkfSurfacePresentation = {
  folderKind: OkfSurfaceFolderKind;
  /** Actual integrity / compatibility failures users should act on. */
  requiredFindings: OkfReviewFinding[];
  /** OKF opt-in prerequisites for an otherwise ordinary Markdown folder. */
  conversionFindings: OkfReviewFinding[];
  /** Model advice, kept distinct from informational relationships. */
  improvementFindings: OkfReviewFinding[];
  /** Reference-only facts such as external links. */
  infoFindings: OkfReviewFinding[];
  requiredCount: number;
  conversionCount: number;
  improvementCount: number;
  infoCount: number;
  hasNoIssues: boolean;
};

const DEFAULT_GROUP_LIMIT = 5;

const PLAIN_MARKDOWN_OKF_PREREQUISITES = new Set([
  "missing-frontmatter",
  "missing-type",
  "invalid-type",
]);

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
    groupLimit?: number;
  },
): OkfSurfacePresentation {
  const groupLimit = options?.groupLimit ?? DEFAULT_GROUP_LIMIT;
  const folderKind = classifyOkfFolderKind(result);
  const isConversionFinding = (finding: OkfReviewFinding) =>
    folderKind === "plain-markdown" &&
    finding.severity === "failure" &&
    PLAIN_MARKDOWN_OKF_PREREQUISITES.has(finding.code);

  const required = result.findings.filter(
    (finding) => finding.severity === "failure" && !isConversionFinding(finding),
  );
  const conversion = result.findings.filter(isConversionFinding);
  const improvement = result.findings.filter(
    (finding) => finding.severity === "advice",
  );
  const info = result.findings.filter((finding) => finding.severity === "info");

  return {
    folderKind,
    requiredFindings: required.slice(0, groupLimit),
    conversionFindings: conversion.slice(0, groupLimit),
    improvementFindings: improvement.slice(0, groupLimit),
    infoFindings: info.slice(0, groupLimit),
    requiredCount: required.length,
    conversionCount: conversion.length,
    improvementCount: improvement.length,
    infoCount: info.length,
    // Conversion prep is not a hard failure for ordinary folders, but it is
    // still work for the user if they intend OKF. Treat it as an issue here.
    hasNoIssues:
      required.length === 0 &&
      conversion.length === 0 &&
      improvement.length === 0,
  };
}
