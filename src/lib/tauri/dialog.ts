import { confirm, open, save as saveDialog } from "@tauri-apps/plugin-dialog";

// Extension allowlist shared by the file / "save as" pickers
// and the file-system `commands/files.rs` validation. The
// `.md` filter gets its own entry for the file picker so the
// dialog labels the common case, but the second "Text" filter
// covers every supported text extension for users who want the
// full list.
export const TEXT_FILE_EXTENSIONS = [
  "md",
  "markdown",
  "mdown",
  "txt",
  "text",
  "log",
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
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
];

const TEXT_FILE_FILTERS = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "mdown"],
  },
  {
    name: "Text",
    extensions: TEXT_FILE_EXTENSIONS,
  },
];

export async function pickMarkdownFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: TEXT_FILE_FILTERS,
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickNewMarkdownFilePath(
  defaultPath: string | null,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultPath ?? "untitled.md",
    filters: TEXT_FILE_FILTERS,
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
    filters: TEXT_FILE_FILTERS,
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

export async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  return confirm(
    "The current file has unsaved changes. Discard them and open another file?",
    {
      title: "Unsaved changes",
      kind: "warning",
    },
  );
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
