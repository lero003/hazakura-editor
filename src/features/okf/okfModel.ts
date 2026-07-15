/**
 * Side-effect-free OKF v0.1 Draft compatibility analyzer (S1).
 * Does not touch the filesystem, UI, or Tauri.
 */

import {
  detectOkfFrontmatter,
  isNonEmptyStringType,
  parseOkfFrontmatterMapping,
  readStringField,
} from "./okfFrontmatter";
import { analyzeBodyLinksBounded } from "./okfLinks";
import {
  conceptIdFromRelativePath,
  directoryFromRelativePath,
  fileNameFromRelativePath,
  isReservedOkfFileName,
  normalizeBundleRelativePath,
} from "./okfPaths";
import { adviseIndexShape, adviseLogShape } from "./okfReserved";
import type {
  OkfAnalyzeOptions,
  OkfMarkdownInput,
  OkfReviewFile,
  OkfReviewFinding,
  OkfReviewResult,
  OkfReviewSummary,
} from "./types";
import {
  OKF_ANALYSIS_BUDGETS,
  OKF_SPEC_COMMIT,
  OKF_SPEC_LABEL,
  OKF_SPEC_VERSION,
} from "./types";

const OPTIONAL_METADATA_KEYS = [
  "title",
  "description",
  "resource",
  "tags",
  "timestamp",
] as const;

export function analyzeOkfBundle(
  inputs: OkfMarkdownInput[],
  options: OkfAnalyzeOptions = {},
): OkfReviewResult {
  const sorted = [...inputs].sort((a, b) =>
    normalizeBundleRelativePath(a.relativePath).localeCompare(
      normalizeBundleRelativePath(b.relativePath),
      "en",
    ),
  );

  const knownFiles = new Set(
    sorted.map((item) => normalizeBundleRelativePath(item.relativePath)),
  );
  const knownDirectories = new Set<string>();
  for (const path of knownFiles) {
    let dir = directoryFromRelativePath(path);
    while (true) {
      knownDirectories.add(dir);
      if (!dir) {
        break;
      }
      const parent = directoryFromRelativePath(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  const files: OkfReviewFile[] = [];
  const findings: OkfReviewFinding[] = [];
  const findingBudget = { truncated: false };
  let declaredOkfVersion: string | null = null;

  for (const input of sorted) {
    const relativePath = normalizeBundleRelativePath(input.relativePath);
    const fileName = fileNameFromRelativePath(relativePath);
    const reserved = isReservedOkfFileName(fileName);
    const isRootIndex =
      reserved && fileName.toLowerCase() === "index.md" && !relativePath.includes("/");
    const isIndex = reserved && fileName.toLowerCase() === "index.md";
    const isLog = reserved && fileName.toLowerCase() === "log.md";

    if (input.content === null) {
      files.push({
        relativePath,
        kind: "unreadable",
        conceptId: null,
        type: null,
        title: null,
        okfVersion: null,
        byteLength: input.byteLength,
        unreadableReason: input.unreadableReason ?? "io-error",
      });
      findings.push({
        severity: "info",
        code: "unreadable-file",
        relativePath,
        message: `Could not read Markdown as UTF-8 text (${input.unreadableReason ?? "io-error"}).`,
      });
      continue;
    }

    const detection = detectOkfFrontmatter(input.content);
    const body = detection.range
      ? input.content.slice(detection.bodyOffset)
      : input.content;

    if (isIndex || isLog) {
      let okfVersion: string | null = null;
      let parsedFields: Record<string, import("./types").OkfFrontmatterValue> = {};

      if (detection.unclosed) {
        findings.push({
          severity: "advice",
          code: "unparseable-frontmatter",
          relativePath,
          message:
            "Reserved file has an unclosed frontmatter fence; treated as reserved, not as a concept.",
        });
      } else if (detection.yamlText !== null) {
        const parsed = parseOkfFrontmatterMapping(detection.yamlText);
        if (parsed.unparseable) {
          findings.push({
            severity: "advice",
            code: "unparseable-frontmatter",
            relativePath,
            message:
              "Reserved file frontmatter could not be parsed; treated as reserved, not as a concept.",
          });
        } else {
          parsedFields = parsed.fields;
          okfVersion = readStringField(parsed.fields, "okf_version");
          if (Object.prototype.hasOwnProperty.call(parsed.fields, "type")) {
            findings.push({
              severity: "advice",
              code: "reserved-type-field",
              relativePath,
              message:
                "Reserved file defines `type` but remains index/log; it is never classified as a concept.",
            });
          }
          if (isRootIndex) {
            if (okfVersion === OKF_SPEC_VERSION) {
              declaredOkfVersion = okfVersion;
            } else if (okfVersion) {
              declaredOkfVersion = okfVersion;
              findings.push({
                severity: "advice",
                code: "root-index-version",
                relativePath,
                message: `Declared okf_version "${okfVersion}" is unknown; consuming with best-effort rules for ${OKF_SPEC_LABEL}.`,
              });
            } else if (Object.keys(parsed.fields).length > 0) {
              findings.push({
                severity: "advice",
                code: "root-index-version",
                relativePath,
                message:
                  "Root index.md frontmatter has no okf_version; consuming with best-effort rules.",
              });
            }
          } else if (isIndex && Object.keys(parsed.fields).length > 0) {
            findings.push({
              severity: "advice",
              code: "nested-index-frontmatter",
              relativePath,
              message:
                "Nested index.md has frontmatter; OKF §6 expects no frontmatter outside the root version declaration.",
            });
          }
        }
      }

      if (isIndex) {
        const shape = adviseIndexShape(body);
        if (shape) {
          findings.push({
            severity: "advice",
            code: shape.code,
            relativePath,
            message: shape.message,
          });
        }
      } else {
        const shape = adviseLogShape(body);
        if (shape) {
          findings.push({
            severity: "advice",
            code: shape.code,
            relativePath,
            message: shape.message,
          });
        }
      }

      files.push({
        relativePath,
        kind: isIndex ? "index" : "log",
        conceptId: null,
        type: null,
        title: readStringField(parsedFields, "title"),
        okfVersion: isRootIndex ? okfVersion : null,
        byteLength: input.byteLength,
      });

      appendLinkFindings(
        body,
        relativePath,
        knownFiles,
        knownDirectories,
        findings,
        findingBudget,
      );
      continue;
    }

    // Concept documents
    if (detection.unclosed) {
      files.push({
        relativePath,
        kind: "concept",
        conceptId: conceptIdFromRelativePath(relativePath),
        type: null,
        title: null,
        okfVersion: null,
        byteLength: input.byteLength,
      });
      findings.push({
        severity: "failure",
        code: "unparseable-frontmatter",
        relativePath,
        message: "Concept has an unclosed YAML frontmatter fence.",
      });
      continue;
    }

    if (detection.yamlText === null) {
      files.push({
        relativePath,
        kind: "concept",
        conceptId: conceptIdFromRelativePath(relativePath),
        type: null,
        title: null,
        okfVersion: null,
        byteLength: input.byteLength,
      });
      findings.push({
        severity: "failure",
        code: "missing-frontmatter",
        relativePath,
        message: "Concept is missing a leading YAML frontmatter block.",
      });
      // Still scan body links for advice when possible.
      appendLinkFindings(
        body,
        relativePath,
        knownFiles,
        knownDirectories,
        findings,
        findingBudget,
      );
      continue;
    }

    const parsed = parseOkfFrontmatterMapping(detection.yamlText);
    if (parsed.unparseable) {
      files.push({
        relativePath,
        kind: "concept",
        conceptId: conceptIdFromRelativePath(relativePath),
        type: null,
        title: null,
        okfVersion: null,
        byteLength: input.byteLength,
      });
      findings.push({
        severity: "failure",
        code: "unparseable-frontmatter",
        relativePath,
        message: "Concept frontmatter is not parseable as a simple YAML mapping.",
      });
      appendLinkFindings(
        body,
        relativePath,
        knownFiles,
        knownDirectories,
        findings,
        findingBudget,
      );
      continue;
    }

    const typeResult = isNonEmptyStringType(parsed.fields);
    let type: string | null = null;
    if (!typeResult.ok) {
      findings.push({
        severity: "failure",
        code: typeResult.reason === "missing" ? "missing-type" : "invalid-type",
        relativePath,
        message:
          typeResult.reason === "missing"
            ? "Concept frontmatter is missing the required `type` string."
            : "Concept `type` must be a non-empty string.",
      });
    } else {
      type = typeResult.type;
      // Unknown types are accepted; optional soft advice for discovery only when
      // the producer uses a clearly placeholder value. We do not maintain a registry.
      if (type === "Unknown" || type.startsWith("x-")) {
        findings.push({
          severity: "advice",
          code: "unknown-type",
          relativePath,
          message: `Concept type "${type}" is producer-defined; tolerated as a generic concept.`,
        });
      }
    }

    const title = readStringField(parsed.fields, "title");
    const missingOptional = OPTIONAL_METADATA_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(parsed.fields, key),
    );
    // Only emit a single soft advice when all recommended fields are absent —
    // avoid noise on partial documents.
    if (missingOptional.length === OPTIONAL_METADATA_KEYS.length) {
      findings.push({
        severity: "advice",
        code: "missing-optional-metadata",
        relativePath,
        message:
          "Concept has no recommended optional metadata (title, description, resource, tags, timestamp).",
      });
    }

    files.push({
      relativePath,
      kind: "concept",
      conceptId: conceptIdFromRelativePath(relativePath),
      type,
      title,
      okfVersion: null,
      byteLength: input.byteLength,
    });

    appendLinkFindings(
      body,
      relativePath,
      knownFiles,
      knownDirectories,
      findings,
      findingBudget,
    );
  }

  // Missing root index is advice only.
  const hasRootIndex = files.some(
    (file) => file.kind === "index" && !file.relativePath.includes("/"),
  );
  if (!hasRootIndex) {
    findings.push({
      severity: "advice",
      code: "index-shape",
      relativePath: "index.md",
      message:
        "Root index.md is absent; consumers may synthesize progressive disclosure.",
    });
  }

  // Stable finding order: by path, then code, then message.
  findings.sort((a, b) => {
    const pathCmp = a.relativePath.localeCompare(b.relativePath, "en");
    if (pathCmp !== 0) {
      return pathCmp;
    }
    const codeCmp = a.code.localeCompare(b.code, "en");
    if (codeCmp !== 0) {
      return codeCmp;
    }
    return a.message.localeCompare(b.message, "en");
  });
  if (findings.length > OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS) {
    findings.length = OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS;
    findingBudget.truncated = true;
  }

  const summary = buildSummary(files, findings, {
    bundleRootLabel: options.bundleRootLabel ?? ".",
    hasRootIndex,
    declaredOkfVersion,
  });

  const totalBytesRead =
    options.totalBytesRead ??
    sorted.reduce((sum, item) => sum + item.byteLength, 0);

  return {
    summary,
    files,
    findings,
    findingsTruncated: findingBudget.truncated,
    scannedEntries: options.scannedEntries ?? sorted.length,
    scannedMarkdownFiles: sorted.length,
    totalBytesRead,
    truncated: options.truncated ?? false,
    truncationReason: options.truncationReason,
    cancelled: options.cancelled ?? false,
    source: "disk",
  };
}

function appendLinkFindings(
  body: string,
  relativePath: string,
  knownFiles: ReadonlySet<string>,
  knownDirectories: ReadonlySet<string>,
  findings: OkfReviewFinding[],
  budget: { truncated: boolean },
): void {
  if (findings.length >= OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS) {
    budget.truncated = true;
    return;
  }

  const bodyTruncated =
    body.length > OKF_ANALYSIS_BUDGETS.MAX_OKF_LINK_SCAN_CHARS_PER_FILE;
  const boundedBody = bodyTruncated
    ? body.slice(0, OKF_ANALYSIS_BUDGETS.MAX_OKF_LINK_SCAN_CHARS_PER_FILE)
    : body;
  const analyzed = analyzeBodyLinksBounded(
    boundedBody,
    {
      sourceRelativePath: relativePath,
      knownFiles,
      knownDirectories,
    },
    OKF_ANALYSIS_BUDGETS.MAX_OKF_LINKS_PER_FILE,
  );
  if (bodyTruncated || analyzed.truncated) {
    budget.truncated = true;
  }

  for (const link of analyzed.links) {
    if (findings.length >= OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS) {
      budget.truncated = true;
      break;
    }
    if (link.kind === "external") {
      findings.push({
        severity: "info",
        code: "external-link",
        relativePath,
        message: `External relationship: ${link.destination}`,
        relatedPath: link.destination,
        sourceOffset: link.sourceOffset,
      });
      continue;
    }
    if (link.kind === "out-of-scope") {
      findings.push({
        severity: "advice",
        code: "out-of-scope-link",
        relativePath,
        message: `Link target is outside the selected bundle root: ${link.destination}`,
        relatedPath: link.destination,
        sourceOffset: link.sourceOffset,
      });
      continue;
    }
    if (link.kind === "unsupported") {
      findings.push({
        severity: "advice",
        code: "unsupported-link",
        relativePath,
        message: `Unsupported link destination: ${link.destination}`,
        relatedPath: link.destination,
        sourceOffset: link.sourceOffset,
      });
      continue;
    }
    if (link.broken) {
      findings.push({
        severity: "advice",
        code: "broken-link",
        relativePath,
        message: `Broken or not-yet-written local link: ${link.destination}`,
        relatedPath: link.targetRelativePath ?? link.destination,
        sourceOffset: link.sourceOffset,
      });
    }
  }
}

function buildSummary(
  files: OkfReviewFile[],
  findings: OkfReviewFinding[],
  meta: {
    bundleRootLabel: string;
    hasRootIndex: boolean;
    declaredOkfVersion: string | null;
  },
): OkfReviewSummary {
  return {
    specLabel: OKF_SPEC_LABEL,
    specVersion: OKF_SPEC_VERSION,
    specCommit: OKF_SPEC_COMMIT,
    bundleRootLabel: meta.bundleRootLabel,
    conceptCount: files.filter((file) => file.kind === "concept").length,
    indexCount: files.filter((file) => file.kind === "index").length,
    logCount: files.filter((file) => file.kind === "log").length,
    unreadableCount: files.filter((file) => file.kind === "unreadable").length,
    failureCount: findings.filter((item) => item.severity === "failure").length,
    adviceCount: findings.filter((item) => item.severity === "advice").length,
    hasRootIndex: meta.hasRootIndex,
    declaredOkfVersion: meta.declaredOkfVersion,
  };
}
