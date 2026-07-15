/**
 * Inline Markdown link extraction and OKF bundle-relative resolution.
 * Contract: docs/v1.11-okf-draft-preview-design.md § Markdown Link Resolution
 *
 * Skips fenced/inline code and requires balanced destination parentheses.
 * Not a full CommonMark parser; sufficient for OKF advice scanning.
 */

import {
  directoryFromRelativePath,
  isPathInsideBundleRoot,
  joinBundleRelativePath,
  normalizeBundleRelativePath,
} from "./okfPaths";
import type { OkfInlineLink, OkfLinkKind } from "./types";

const EXTERNAL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

export function extractInlineMarkdownLinks(body: string): Array<{
  text: string;
  destination: string;
  sourceOffset: number;
}> {
  return extractInlineMarkdownLinksBounded(body, Number.POSITIVE_INFINITY).links;
}

export type BoundedOkfLinks = {
  links: Array<{
    text: string;
    destination: string;
    sourceOffset: number;
  }>;
  truncated: boolean;
};

export function extractInlineMarkdownLinksBounded(
  body: string,
  maxLinks: number,
): BoundedOkfLinks {
  const results: Array<{
    text: string;
    destination: string;
    sourceOffset: number;
  }> = [];
  const workBudget = createLinkScanWorkBudget(body.length, maxLinks);
  const masked = maskCodeRegionsWithBudget(body, workBudget);
  if (workBudget.exhausted) {
    return { links: results, truncated: true };
  }

  let index = 0;
  while (index < masked.length) {
    if (!spendLinkScanWork(workBudget)) {
      return { links: results, truncated: true };
    }
    const openBracket = masked.indexOf("[", index);
    if (openBracket === -1) {
      break;
    }

    // Image marker ![ or escaped \[
    if (openBracket > 0 && (masked[openBracket - 1] === "!" || masked[openBracket - 1] === "\\")) {
      index = openBracket + 1;
      continue;
    }

    const closeBracket = findClosingBracket(
      masked,
      openBracket + 1,
      workBudget,
    );
    if (workBudget.exhausted) {
      return { links: results, truncated: true };
    }
    if (closeBracket === -1) {
      index = openBracket + 1;
      continue;
    }

    if (masked[closeBracket + 1] !== "(") {
      index = closeBracket + 1;
      continue;
    }

    const destStart = closeBracket + 2;
    const destEnd = findBalancedDestinationEnd(
      masked,
      destStart,
      workBudget,
    );
    if (workBudget.exhausted) {
      return { links: results, truncated: true };
    }
    if (destEnd === -1) {
      index = closeBracket + 1;
      continue;
    }

    // Read labels/destinations from the original body so code-masking
    // spaces do not alter text (they only block detection).
    const text = body.slice(openBracket + 1, closeBracket);
    const rawDest = body.slice(destStart, destEnd).trim();
    const destination = stripLinkTitle(rawDest);
    if (results.length >= maxLinks) {
      return { links: results, truncated: true };
    }
    results.push({
      text,
      destination,
      sourceOffset: openBracket,
    });
    index = destEnd + 1;
  }

  return { links: results, truncated: false };
}

/**
 * Replace fenced code blocks and inline code with spaces so link scans
 * skip them while preserving character offsets.
 */
export function maskCodeRegions(source: string): string {
  return maskCodeRegionsWithBudget(source, {
    remaining: Number.POSITIVE_INFINITY,
    exhausted: false,
  });
}

type LinkScanWorkBudget = {
  remaining: number;
  exhausted: boolean;
};

function createLinkScanWorkBudget(
  bodyLength: number,
  maxLinks: number,
): LinkScanWorkBudget {
  return {
    // The production analyzer always supplies a finite link cap. Bound parser
    // work linearly as well, so malformed bracket/backtick runs cannot turn the
    // character cap into quadratic CPU work.
    remaining: Number.isFinite(maxLinks)
      ? Math.max(1_000, bodyLength * 8)
      : Number.POSITIVE_INFINITY,
    exhausted: false,
  };
}

function spendLinkScanWork(budget: LinkScanWorkBudget): boolean {
  if (!Number.isFinite(budget.remaining)) {
    return true;
  }
  if (budget.remaining <= 0) {
    budget.exhausted = true;
    return false;
  }
  budget.remaining -= 1;
  return true;
}

function maskCodeRegionsWithBudget(
  source: string,
  workBudget: LinkScanWorkBudget,
): string {
  const chars = source.split("");
  let i = 0;
  while (i < chars.length) {
    if (!spendLinkScanWork(workBudget)) {
      break;
    }
    // Fenced code: optional 1–3 leading spaces (CommonMark) then ``` or ~~~.
    if (isLineStart(source, i)) {
      const fenceStart = fenceMarkerIndex(source, i);
      if (fenceStart !== -1) {
        const fenceChar = source[fenceStart]!;
        let fenceLen = 0;
        while (source[fenceStart + fenceLen] === fenceChar) {
          fenceLen += 1;
        }
        const openEnd = indexOfLineEnd(source, fenceStart);
        let j = openEnd + 1;
        let closed = false;
        while (j < source.length) {
          if (!spendLinkScanWork(workBudget)) {
            return chars.join("");
          }
          if (isLineStart(source, j)) {
            const closeStart = fenceMarkerIndex(source, j);
            if (closeStart !== -1 && source[closeStart] === fenceChar) {
              let closeLen = 0;
              while (source[closeStart + closeLen] === fenceChar) {
                closeLen += 1;
              }
              if (closeLen >= fenceLen) {
                const closeEnd = indexOfLineEnd(source, closeStart);
                blankRange(chars, i, closeEnd + 1);
                i = closeEnd + 1;
                closed = true;
                break;
              }
            }
          }
          j += 1;
        }
        if (!closed) {
          blankRange(chars, i, chars.length);
          break;
        }
        continue;
      }
    }

    // Inline code: `...` (not part of a fence already handled)
    if (chars[i] === "`") {
      let tickCount = 0;
      while (chars[i + tickCount] === "`") {
        tickCount += 1;
      }
      let j = i + tickCount;
      let closedAt = -1;
      while (j < chars.length) {
        if (!spendLinkScanWork(workBudget)) {
          return chars.join("");
        }
        if (chars[j] === "`") {
          let closeCount = 0;
          while (chars[j + closeCount] === "`") {
            closeCount += 1;
          }
          if (closeCount === tickCount) {
            closedAt = j + closeCount;
            break;
          }
          j += closeCount;
          continue;
        }
        j += 1;
      }
      if (closedAt !== -1) {
        blankRange(chars, i, closedAt);
        i = closedAt;
        continue;
      }
    }

    i += 1;
  }
  return chars.join("");
}

function isLineStart(source: string, index: number): boolean {
  return index === 0 || source[index - 1] === "\n";
}

/**
 * CommonMark allows a fence after 0–3 spaces from the line start.
 * Returns the index of the first fence character, or -1.
 */
function fenceMarkerIndex(source: string, lineStart: number): number {
  let i = lineStart;
  let spaces = 0;
  while (spaces < 3 && source[i] === " ") {
    spaces += 1;
    i += 1;
  }
  const ch = source[i];
  if (
    (ch === "`" || ch === "~") &&
    source[i + 1] === ch &&
    source[i + 2] === ch
  ) {
    return i;
  }
  return -1;
}

function indexOfLineEnd(source: string, index: number): number {
  const next = source.indexOf("\n", index);
  return next === -1 ? source.length - 1 : next;
}

function blankRange(chars: string[], start: number, end: number): void {
  for (let i = start; i < end && i < chars.length; i += 1) {
    if (chars[i] !== "\n" && chars[i] !== "\r") {
      chars[i] = " ";
    }
  }
}

function findClosingBracket(
  source: string,
  from: number,
  workBudget: LinkScanWorkBudget,
): number {
  let depth = 1;
  for (let i = from; i < source.length; i += 1) {
    if (!spendLinkScanWork(workBudget)) {
      return -1;
    }
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      i += 1;
      continue;
    }
    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/** Find the closing `)` of a link destination, allowing balanced parentheses. */
function findBalancedDestinationEnd(
  source: string,
  from: number,
  workBudget: LinkScanWorkBudget,
): number {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  for (let i = from; i < source.length; i += 1) {
    if (!spendLinkScanWork(workBudget)) {
      return -1;
    }
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === "'") {
        inSingle = true;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        continue;
      }
      if (ch === "(") {
        depth += 1;
        continue;
      }
      if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          return i;
        }
        continue;
      }
      if (ch === "\n") {
        return -1;
      }
    } else if (inSingle && ch === "'") {
      inSingle = false;
    } else if (inDouble && ch === '"') {
      inDouble = false;
    }
  }
  return -1;
}

function stripLinkTitle(raw: string): string {
  const titled = /^(\S+)\s+["'](.*)["']\s*$/.exec(raw);
  if (titled) {
    return titled[1] ?? raw;
  }
  return raw.trim();
}

export type OkfLinkContext = {
  /** Relative path of the source Markdown file. */
  sourceRelativePath: string;
  /** Set of known file paths (bundle-relative, normalized). */
  knownFiles: ReadonlySet<string>;
  /** Set of known directories (bundle-relative; "" for root). */
  knownDirectories: ReadonlySet<string>;
};

export function classifyOkfInlineLink(
  destination: string,
  context: OkfLinkContext,
): Omit<OkfInlineLink, "text" | "sourceOffset"> {
  const trimmed = destination.trim();

  if (!trimmed) {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  // Fragment-only links stay inside the source document.
  if (trimmed.startsWith("#")) {
    return {
      destination: trimmed,
      kind: "internal",
      targetRelativePath: context.sourceRelativePath,
      broken: false,
    };
  }

  // Scheme-based destinations.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1]?.toLowerCase()}:`;
    if (EXTERNAL_SCHEMES.has(scheme)) {
      return {
        destination: trimmed,
        kind: "external",
        targetRelativePath: null,
        broken: false,
      };
    }
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  if (trimmed.startsWith("//")) {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  const withoutQuery = trimmed.split("?", 1)[0] ?? "";
  const withoutFragment = withoutQuery.split("#", 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutFragment.trim());
  } catch {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  // Destination was only query/fragment after a path-less root.
  if (decoded === "") {
    return {
      destination: trimmed,
      kind: "internal",
      targetRelativePath: context.sourceRelativePath,
      broken: false,
    };
  }

  if (decoded.includes("\0")) {
    return {
      destination: trimmed,
      kind: "unsupported",
      targetRelativePath: null,
      broken: false,
    };
  }

  let targetRelative: string;
  if (decoded.startsWith("/")) {
    targetRelative = normalizeBundleRelativePath(decoded.slice(1));
  } else {
    const sourceDir = directoryFromRelativePath(context.sourceRelativePath);
    targetRelative = joinBundleRelativePath(sourceDir, decoded);
  }

  if (!isPathInsideBundleRoot(targetRelative)) {
    return {
      destination: trimmed,
      kind: "out-of-scope",
      targetRelativePath: null,
      broken: false,
    };
  }

  const existence = resolveTargetExistence(
    targetRelative,
    context.knownFiles,
    context.knownDirectories,
  );

  return {
    destination: trimmed,
    kind: "internal",
    targetRelativePath: existence.canonicalPath,
    broken: !existence.exists,
  };
}

function resolveTargetExistence(
  targetRelative: string,
  knownFiles: ReadonlySet<string>,
  knownDirectories: ReadonlySet<string>,
): { exists: boolean; canonicalPath: string } {
  const normalized = normalizeBundleRelativePath(targetRelative);

  if (normalized === "") {
    return { exists: true, canonicalPath: "" };
  }

  if (knownFiles.has(normalized)) {
    return { exists: true, canonicalPath: normalized };
  }

  if (!normalized.toLowerCase().endsWith(".md")) {
    const asMd = `${normalized}.md`;
    if (knownFiles.has(asMd)) {
      return { exists: true, canonicalPath: asMd };
    }
  }

  if (knownDirectories.has(normalized)) {
    const indexPath = normalizeBundleRelativePath(`${normalized}/index.md`);
    if (knownFiles.has(indexPath)) {
      return { exists: true, canonicalPath: indexPath };
    }
    return { exists: true, canonicalPath: normalized };
  }

  const indexPath = normalizeBundleRelativePath(`${normalized}/index.md`);
  if (knownFiles.has(indexPath)) {
    return { exists: true, canonicalPath: indexPath };
  }

  return { exists: false, canonicalPath: normalized };
}

export function analyzeBodyLinks(
  body: string,
  context: OkfLinkContext,
): OkfInlineLink[] {
  return analyzeBodyLinksBounded(
    body,
    context,
    Number.POSITIVE_INFINITY,
  ).links;
}

export function analyzeBodyLinksBounded(
  body: string,
  context: OkfLinkContext,
  maxLinks: number,
): { links: OkfInlineLink[]; truncated: boolean } {
  const extracted = extractInlineMarkdownLinksBounded(body, maxLinks);
  return {
    truncated: extracted.truncated,
    links: extracted.links.map((link) => {
      const classified = classifyOkfInlineLink(link.destination, context);
      return {
        text: link.text,
        destination: link.destination,
        sourceOffset: link.sourceOffset,
        kind: classified.kind,
        targetRelativePath: classified.targetRelativePath,
        broken: classified.broken,
      };
    }),
  };
}

export function linkKindLabel(kind: OkfLinkKind): string {
  return kind;
}
