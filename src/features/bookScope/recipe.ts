import {
  flattenBookScopeNodes,
  sanitizeBookScopeNodes,
  type BookScopeNode,
} from "./model";

/** Portable, user-explicit book order file. Never auto-loaded. */
export const BOOK_RECIPE_FORMAT = "hazakura-book-recipe" as const;
export const BOOK_RECIPE_VERSION = 1 as const;
export const BOOK_RECIPE_FILE_EXTENSION = "hazakura-book.json";

export const BOOK_RECIPE_DESCRIPTION =
  "Portable chapter order for Hazakura Editor. Relative Markdown paths only. Not an OKF standard and not auto-loaded.";

export type BookRecipeDocument = {
  format: typeof BOOK_RECIPE_FORMAT;
  version: typeof BOOK_RECIPE_VERSION;
  description: string;
  nodes: BookScopeNode[];
};

export type ParseBookRecipeResult =
  | {
      ok: true;
      nodes: BookScopeNode[];
      chapterRelativePaths: string[];
    }
  | {
      ok: false;
      error: string;
    };

export function buildBookRecipe(
  nodes: readonly BookScopeNode[],
): BookRecipeDocument {
  const sanitized = sanitizeBookScopeNodes(nodes);
  return {
    format: BOOK_RECIPE_FORMAT,
    version: BOOK_RECIPE_VERSION,
    description: BOOK_RECIPE_DESCRIPTION,
    nodes: sanitized,
  };
}

export function serializeBookRecipe(nodes: readonly BookScopeNode[]): string {
  return `${JSON.stringify(buildBookRecipe(nodes), null, 2)}\n`;
}

export function parseBookRecipe(text: string): ParseBookRecipeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "invalid-shape" };
  }
  const candidate = parsed as {
    format?: unknown;
    version?: unknown;
    nodes?: unknown;
    chapterRelativePaths?: unknown;
  };
  if (candidate.format !== BOOK_RECIPE_FORMAT) {
    return { ok: false, error: "unknown-format" };
  }
  if (candidate.version !== BOOK_RECIPE_VERSION) {
    return { ok: false, error: "unsupported-version" };
  }

  let nodes: BookScopeNode[] = [];
  if (Array.isArray(candidate.nodes)) {
    nodes = sanitizeBookScopeNodes(candidate.nodes);
  } else if (Array.isArray(candidate.chapterRelativePaths)) {
    // Flat list fallback for hand-authored recipes.
    nodes = sanitizeBookScopeNodes(
      candidate.chapterRelativePaths
        .filter((path): path is string => typeof path === "string")
        .map((relativePath) => ({
          kind: "document" as const,
          relativePath,
          children: [],
        })),
    );
  } else {
    return { ok: false, error: "missing-nodes" };
  }

  const chapterRelativePaths = flattenBookScopeNodes(nodes);
  if (chapterRelativePaths.length === 0) {
    return { ok: false, error: "empty-recipe" };
  }
  return { ok: true, nodes, chapterRelativePaths };
}

export function defaultBookRecipeFileName(workspaceLabel: string | null): string {
  const base =
    workspaceLabel
      ?.replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "book";
  return `${base}.${BOOK_RECIPE_FILE_EXTENSION}`;
}

export function bookRecipeErrorMessage(
  error: string,
  language: "en" | "ja",
): string {
  const messages =
    language === "en"
      ? {
          "invalid-json": "That file is not valid JSON.",
          "invalid-shape": "That file is not a book recipe.",
          "unknown-format": "Unknown recipe format (expected hazakura-book-recipe).",
          "unsupported-version": "This recipe version is not supported.",
          "missing-nodes": "The recipe has no chapter list.",
          "empty-recipe": "The recipe has no usable Markdown chapters.",
        }
      : {
          "invalid-json": "JSONとして読めません。",
          "invalid-shape": "本の章立てファイルではありません。",
          "unknown-format":
            "未知の形式です（hazakura-book-recipe が必要です）。",
          "unsupported-version": "この版の章立てファイルには対応していません。",
          "missing-nodes": "章の一覧がありません。",
          "empty-recipe": "使える Markdown の章がありません。",
        };
  return (
    messages[error as keyof typeof messages] ??
    (language === "en" ? "Could not read the book recipe." : "章立てを読めませんでした。")
  );
}
