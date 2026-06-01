import { useMemo } from "react";
import type { SearchOptions, TextMatch } from "../types";

type UseFindMatchesOptions = {
  options: SearchOptions;
  query: string;
  source: string;
};

export function useFindMatches({
  options,
  query,
  source,
}: UseFindMatchesOptions) {
  const findMatches = useMemo(
    () => findTextMatches(source, query, options),
    [source, query, options],
  );
  const invalidRegex =
    options.regex && query.trim().length > 0 ? !canCompileRegex(query) : false;

  return {
    findMatches,
    invalidRegex,
  };
}

function findTextMatches(
  source: string,
  query: string,
  options: SearchOptions,
): TextMatch[] {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  if (options.regex) {
    return findRegexMatches(source, normalizedQuery, options);
  }

  const haystack = options.caseSensitive ? source : source.toLowerCase();
  const needle = options.caseSensitive
    ? normalizedQuery
    : normalizedQuery.toLowerCase();
  const matches: TextMatch[] = [];
  let cursor = 0;

  while (matches.length < 999) {
    const foundAt = haystack.indexOf(needle, cursor);

    if (foundAt === -1) {
      break;
    }

    const to = foundAt + needle.length;

    if (!options.wholeWord || isWordBoundary(source, foundAt, to)) {
      matches.push({ from: foundAt, to });
    }

    cursor = foundAt + Math.max(needle.length, 1);
  }

  return matches;
}

function findRegexMatches(
  source: string,
  query: string,
  options: SearchOptions,
): TextMatch[] {
  const matches: TextMatch[] = [];

  try {
    const flags = options.caseSensitive ? "gu" : "giu";
    const regex = new RegExp(query, flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) && matches.length < 999) {
      const from = match.index;
      const to = from + match[0].length;

      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }

      if (!options.wholeWord || isWordBoundary(source, from, to)) {
        matches.push({ from, to });
      }
    }
  } catch {
    return [];
  }

  return matches;
}

function canCompileRegex(query: string): boolean {
  try {
    new RegExp(query, "u");
    return true;
  } catch {
    return false;
  }
}

function isWordBoundary(source: string, from: number, to: number): boolean {
  const before = from > 0 ? source[from - 1] : "";
  const after = to < source.length ? source[to] : "";

  return !isWordCharacter(before) && !isWordCharacter(after);
}

function isWordCharacter(char: string): boolean {
  return /^[\p{L}\p{N}_]$/u.test(char);
}
