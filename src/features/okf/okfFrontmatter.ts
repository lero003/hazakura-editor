/**
 * OKF frontmatter interpretation for v1.11.
 *
 * Uses `findYamlFrontmatter` only for the leading `---` range, then parses
 * the YAML body with the direct `yaml` package. Conversion of parsed values
 * is cycle-safe so parser-accepted anchors/aliases never throw.
 */

import { parse as parseYaml } from "yaml";
import { findYamlFrontmatter } from "../editor/markdownFrontmatter";
import type { OkfFrontmatterValue, OkfParsedFrontmatter } from "./types";

/** Max object/array depth when converting YAML values for display/classify. */
const MAX_OKF_VALUE_DEPTH = 32;

export type OkfFrontmatterDetection = {
  range: { bodyOffset: number; endLine: number } | null;
  /** Text between the opening and closing `---` lines, excluding delimiters. */
  yamlText: string | null;
  unclosed: boolean;
  bodyOffset: number;
};

export function detectOkfFrontmatter(source: string): OkfFrontmatterDetection {
  const range = findYamlFrontmatter(source);
  if (range) {
    return {
      range,
      yamlText: extractYamlBetweenDelimiters(source),
      unclosed: false,
      bodyOffset: range.bodyOffset,
    };
  }

  const firstLineEnd = source.indexOf("\n");
  const firstLine =
    firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  if (firstLine.trim() === "---") {
    return {
      range: null,
      yamlText: null,
      unclosed: true,
      bodyOffset: 0,
    };
  }

  return {
    range: null,
    yamlText: null,
    unclosed: false,
    bodyOffset: 0,
  };
}

/**
 * Walk the same line structure as `findYamlFrontmatter` and collect YAML lines.
 */
function extractYamlBetweenDelimiters(source: string): string {
  const firstLineEnd = source.indexOf("\n");
  if (firstLineEnd === -1) {
    return "";
  }

  const yamlLines: string[] = [];
  let lineStart = firstLineEnd + 1;

  while (lineStart <= source.length) {
    const lineEnd = source.indexOf("\n", lineStart);
    const effectiveEnd = lineEnd === -1 ? source.length : lineEnd;
    const line = source.slice(lineStart, effectiveEnd);
    if (line.trim() === "---") {
      return yamlLines.join("\n");
    }
    yamlLines.push(line);
    if (lineEnd === -1) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  return yamlLines.join("\n");
}

/**
 * Parse frontmatter YAML into a mapping. Non-mapping roots and parser
 * errors are unparseable (compatibility failure for concepts).
 */
export function parseOkfFrontmatterMapping(
  yamlText: string,
): OkfParsedFrontmatter {
  if (yamlText.trim() === "") {
    return { raw: yamlText, fields: emptyFields(), unparseable: false };
  }

  try {
    const parsed: unknown = parseYaml(yamlText, {
      uniqueKeys: true,
      strict: true,
      maxAliasCount: 100,
    });

    if (parsed === null || parsed === undefined) {
      return { raw: yamlText, fields: emptyFields(), unparseable: false };
    }

    if (!isPlainObject(parsed)) {
      return { raw: yamlText, fields: emptyFields(), unparseable: true };
    }

    const fields = Object.create(null) as Record<string, OkfFrontmatterValue>;
    for (const [key, value] of Object.entries(parsed)) {
      fields[key] = toOkfValue(value);
    }
    return { raw: yamlText, fields, unparseable: false };
  } catch {
    return { raw: yamlText, fields: emptyFields(), unparseable: true };
  }
}

function emptyFields(): Record<string, OkfFrontmatterValue> {
  return Object.create(null) as Record<string, OkfFrontmatterValue>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Convert a parsed YAML value into a plain JSON-like tree.
 * Cycles and excessive depth become placeholders so unknown fields stay
 * tolerable without throwing or infinite recursion.
 */
export function toOkfValue(value: unknown): OkfFrontmatterValue {
  return toOkfValueInner(value, new WeakSet<object>(), 0);
}

function toOkfValueInner(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): OkfFrontmatterValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== "object") {
    return String(value);
  }

  if (depth >= MAX_OKF_VALUE_DEPTH) {
    return "[max-depth]";
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return "[circular]";
  }
  seen.add(objectValue);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => toOkfValueInner(item, seen, depth + 1));
    }

    if (isPlainObject(value)) {
      const result = Object.create(null) as {
        [key: string]: OkfFrontmatterValue;
      };
      for (const [key, child] of Object.entries(value)) {
        result[key] = toOkfValueInner(child, seen, depth + 1);
      }
      return result;
    }

    return String(value);
  } finally {
    // Track the active recursion path only. A non-cyclic alias may appear
    // more than once and must be converted normally each time.
    seen.delete(objectValue);
  }
}

export function readStringField(
  fields: Record<string, OkfFrontmatterValue>,
  key: string,
): string | null {
  const value = fields[key];
  return typeof value === "string" ? value : null;
}

export function isNonEmptyStringType(
  fields: Record<string, OkfFrontmatterValue>,
): { ok: true; type: string } | { ok: false; reason: "missing" | "invalid" } {
  if (!Object.prototype.hasOwnProperty.call(fields, "type")) {
    return { ok: false, reason: "missing" };
  }
  const value = fields.type;
  if (typeof value !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (value.trim() === "") {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, type: value };
}
