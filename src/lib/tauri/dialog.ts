import { confirm, open, save as saveDialog } from "@tauri-apps/plugin-dialog";

// Save-dialog extension helpers. Opening text files is intentionally
// not extension-gated; Rust validates the selected file by size,
// binary-looking bytes, and text decoding.
export const TEXT_FILE_EXTENSIONS = [
  "md",
  "markdown",
  "mdown",
  "mdx",
  "txt",
  "text",
  "log",
  "rst",
  "adoc",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "toml",
  "csv",
  "tsv",
  "css",
  "html",
  "xml",
  "ini",
  "conf",
  "env",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "py",
  "rb",
  "go",
  "rs",
  "swift",
  "kt",
  "kts",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "sql",
  "graphql",
  "gql",
];

// Per-extension filter entries for the save dialog. Platforms
// expose these differently (macOS may hide them behind the
// expanded dialog state), but passing them keeps Save As from
// being Markdown-only and lets the OS append the selected
// filter's extension when supported.
const SAVE_AS_TEXT_FILE_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mdx"] },
  { name: "Plain Text", extensions: ["txt", "text", "log"] },
  { name: "HTML", extensions: ["html", "htm"] },
  { name: "CSS", extensions: ["css"] },
  {
    name: "JavaScript / TypeScript",
    extensions: ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"],
  },
  { name: "JSON", extensions: ["json", "jsonl"] },
  { name: "YAML", extensions: ["yaml", "yml"] },
  { name: "Config", extensions: ["toml", "ini", "conf", "env"] },
  { name: "Data", extensions: ["csv", "tsv", "xml"] },
  {
    name: "Source / Text",
    extensions: TEXT_FILE_EXTENSIONS,
  },
];

export async function pickMarkdownFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
  });

  return typeof selected === "string" ? selected : null;
}

/** User-selected PDF or image for Import Assist (absolute path). */
export async function pickImportSourceFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "PDF / Image",
        extensions: ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "heic", "heif"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

/** User-selected text / PDF / image for Reference Compare (absolute path). */
export async function pickReferenceFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Reference",
        extensions: [
          "md",
          "markdown",
          "mdown",
          "txt",
          "text",
          "pdf",
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
        ],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickNewMarkdownFilePath(
  defaultPath: string | null,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultPath ?? "untitled.md",
    filters: SAVE_AS_TEXT_FILE_FILTERS,
  });

  return typeof selected === "string"
    ? normalizeSelectedTextFilePath(selected)
    : null;
}

export async function pickSaveAsTextFilePath(
  defaultPath: string | null,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultPath ?? "untitled-copy.md",
    filters: SAVE_AS_TEXT_FILE_FILTERS,
  });

  return typeof selected === "string"
    ? normalizeSelectedTextFilePath(selected)
    : null;
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });

  return typeof selected === "string" ? selected : null;
}

/** Explicit portable Book recipe (JSON). Never auto-loaded by the app. */
export async function pickBookRecipeFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Hazakura book recipe",
        extensions: ["json", "hazakura-book.json"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickBookRecipeSavePath(
  defaultPath: string,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath,
    filters: [
      {
        name: "Hazakura book recipe",
        extensions: ["json"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  return confirm(
    "The current file has unsaved changes. Discard them and open another file?",
    {
      title: "Unsaved changes",
      kind: "warning",
    },
  );
}

/** Confirm before Import Assist creates an unsaved Markdown draft. */
export async function confirmImportMarkdownDraft(options: {
  fileName: string;
  message: string;
  title: string;
}): Promise<boolean> {
  return confirm(options.message, {
    title: options.title,
    kind: "info",
  });
}

/** Confirm the network side effect when pinning remote images while Preview remote is Off. */
export async function confirmPinRemoteImages(options: {
  message: string;
  title: string;
}): Promise<boolean> {
  return confirm(options.message, {
    title: options.title,
    kind: "warning",
  });
}

// macOS save-as dialogs sometimes append a duplicate extension
// when the user types "foo.md" against a filter that lists
// ".md" (the OS sees "foo.md.md"). Strip the duplicate only
// when the trailing two segments are both in the allowlist
// — otherwise we'd mangle intentional double-dot names.
function normalizeSelectedTextFilePath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex === -1 ? "" : path.slice(0, slashIndex + 1);
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  const segments = fileName.split(".");

  if (segments.length < 3) {
    return path;
  }

  const finalExtension = segments.at(-1)?.toLowerCase() ?? "";
  const typedExtension = segments.at(-2)?.toLowerCase() ?? "";

  if (
    TEXT_FILE_EXTENSIONS.includes(finalExtension) &&
    TEXT_FILE_EXTENSIONS.includes(typedExtension)
  ) {
    return `${directory}${segments.slice(0, -1).join(".")}`;
  }

  return path;
}
