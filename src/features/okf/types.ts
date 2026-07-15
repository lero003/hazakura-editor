/**
 * v1.11 OKF Draft Compatibility Preview — thin result model.
 * Contract: docs/v1.11-okf-draft-preview-design.md
 * Spec pin: OKF v0.1 Draft, commit ee67a5c
 */

export const OKF_SPEC_VERSION = "0.1" as const;
export const OKF_SPEC_COMMIT = "ee67a5c" as const;
export const OKF_SPEC_LABEL = "OKF v0.1 Draft" as const;

/** Discovery budgets (Rust owns enforcement; mirrored for docs/tests). */
export const OKF_BUDGETS = {
  MAX_OKF_WALK_ENTRIES: 2_000,
  MAX_OKF_MARKDOWN_FILES: 200,
  MAX_OKF_FILE_BYTES: 10 * 1024 * 1024,
  MAX_OKF_TOTAL_BYTES: 32 * 1024 * 1024,
  MAX_OKF_DEPTH: 16,
} as const;

/** Pure-model/UI budgets. These bound CPU, allocations, and rendered rows. */
export const OKF_ANALYSIS_BUDGETS = {
  MAX_OKF_LINK_SCAN_CHARS_PER_FILE: 1_000_000,
  MAX_OKF_LINKS_PER_FILE: 500,
  MAX_OKF_FINDINGS: 1_000,
} as const;

export type OkfFileKind =
  | "concept"
  | "index"
  | "log"
  | "unreadable";

export type OkfFindingSeverity = "failure" | "advice" | "info";

export type OkfFindingCode =
  | "missing-frontmatter"
  | "unparseable-frontmatter"
  | "missing-type"
  | "invalid-type"
  | "unknown-type"
  | "missing-optional-metadata"
  | "root-index-version"
  | "nested-index-frontmatter"
  | "index-shape"
  | "log-shape"
  | "broken-link"
  | "out-of-scope-link"
  | "external-link"
  | "unsupported-link"
  | "unreadable-file"
  | "reserved-type-field";

export type OkfTruncationReason =
  | "walk-entries"
  | "markdown-files"
  | "file-bytes"
  | "total-bytes"
  | "depth";

export type OkfUnreadableReason =
  | "non-utf8"
  | "io-error"
  | "over-budget";

/** Disk snapshot input for one Markdown candidate (S1 pure model). */
export type OkfMarkdownInput = {
  /** Bundle-root-relative path using `/` separators. */
  relativePath: string;
  /** UTF-8 text, or null when discovery could not read it safely. */
  content: string | null;
  byteLength: number;
  unreadableReason?: OkfUnreadableReason;
};

export type OkfFrontmatterValue =
  | string
  | number
  | boolean
  | null
  | OkfFrontmatterValue[]
  | { [key: string]: OkfFrontmatterValue };

export type OkfParsedFrontmatter = {
  raw: string;
  fields: Record<string, OkfFrontmatterValue>;
  /** True when the YAML body could not be interpreted as a mapping. */
  unparseable: boolean;
};

export type OkfLinkKind =
  | "internal"
  | "external"
  | "out-of-scope"
  | "unsupported";

export type OkfInlineLink = {
  text: string;
  destination: string;
  kind: OkfLinkKind;
  /** Normalized bundle-relative target path when resolvable. */
  targetRelativePath: string | null;
  /** True when kind is internal and the target is not among scanned files/dirs. */
  broken: boolean;
  sourceOffset: number;
};

export type OkfReviewFile = {
  relativePath: string;
  kind: OkfFileKind;
  conceptId: string | null;
  type: string | null;
  title: string | null;
  okfVersion: string | null;
  byteLength: number;
  unreadableReason?: OkfUnreadableReason;
};

export type OkfReviewFinding = {
  severity: OkfFindingSeverity;
  code: OkfFindingCode;
  relativePath: string;
  message: string;
  relatedPath?: string;
  sourceOffset?: number;
};

export type OkfReviewSummary = {
  specLabel: typeof OKF_SPEC_LABEL;
  specVersion: typeof OKF_SPEC_VERSION;
  specCommit: typeof OKF_SPEC_COMMIT;
  bundleRootLabel: string;
  conceptCount: number;
  indexCount: number;
  logCount: number;
  unreadableCount: number;
  failureCount: number;
  adviceCount: number;
  hasRootIndex: boolean;
  declaredOkfVersion: string | null;
};

export type OkfReviewResult = {
  summary: OkfReviewSummary;
  files: OkfReviewFile[];
  findings: OkfReviewFinding[];
  findingsTruncated: boolean;
  scannedEntries: number;
  scannedMarkdownFiles: number;
  totalBytesRead: number;
  truncated: boolean;
  truncationReason?: OkfTruncationReason;
  cancelled: boolean;
  source: "disk";
};

export type OkfAnalyzeOptions = {
  bundleRootLabel?: string;
  scannedEntries?: number;
  totalBytesRead?: number;
  truncated?: boolean;
  truncationReason?: OkfTruncationReason;
  cancelled?: boolean;
};
