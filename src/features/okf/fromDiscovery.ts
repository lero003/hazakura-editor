/**
 * Bridge discovery payload (Rust) → pure OKF model (TypeScript).
 */

import { analyzeOkfBundle } from "./okfModel";
import type {
  OkfAnalyzeOptions,
  OkfMarkdownInput,
  OkfReviewResult,
  OkfTruncationReason,
  OkfUnreadableReason,
} from "./types";

export type OkfDiscoveryLike = {
  bundleRoot: string;
  files: Array<{
    relativePath: string;
    content: string | null;
    byteLength: number;
    unreadableReason?: string | null;
  }>;
  scannedEntries: number;
  scannedMarkdownFiles: number;
  totalBytesRead: number;
  truncated: boolean;
  truncationReason?: string | null;
  cancelled: boolean;
};

const UNREADABLE_REASONS = new Set<OkfUnreadableReason>([
  "non-utf8",
  "io-error",
  "over-budget",
]);

const TRUNCATION_REASONS = new Set<OkfTruncationReason>([
  "walk-entries",
  "markdown-files",
  "file-bytes",
  "total-bytes",
  "depth",
]);

export function discoveryToMarkdownInputs(
  discovery: OkfDiscoveryLike,
): OkfMarkdownInput[] {
  return discovery.files.map((file) => {
    const reason = file.unreadableReason;
    const unreadableReason =
      reason && UNREADABLE_REASONS.has(reason as OkfUnreadableReason)
        ? (reason as OkfUnreadableReason)
        : file.content === null
          ? "io-error"
          : undefined;

    return {
      relativePath: file.relativePath,
      content: file.content,
      byteLength: file.byteLength,
      unreadableReason,
    };
  });
}

export function analyzeDiscoveryResult(
  discovery: OkfDiscoveryLike,
  options: Pick<OkfAnalyzeOptions, "bundleRootLabel"> = {},
): OkfReviewResult {
  const truncationReason =
    discovery.truncationReason &&
    TRUNCATION_REASONS.has(discovery.truncationReason as OkfTruncationReason)
      ? (discovery.truncationReason as OkfTruncationReason)
      : undefined;

  return analyzeOkfBundle(discoveryToMarkdownInputs(discovery), {
    bundleRootLabel: options.bundleRootLabel ?? discovery.bundleRoot,
    scannedEntries: discovery.scannedEntries,
    totalBytesRead: discovery.totalBytesRead,
    truncated: discovery.truncated,
    truncationReason,
    cancelled: discovery.cancelled,
  });
}
