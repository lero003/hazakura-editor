/**
 * L Mode is a Markdown presentation layer. CSS/HTML force a Markdown parser
 * switch that drops CodeMirror undo history on remount, so L Mode is only
 * available for Markdown-like documents.
 */

const MARKDOWN_EXTENSIONS = new Set([
  "md",
  "markdown",
  "mdown",
  "mkd",
  "mdx",
]);

export function isLModeSupportedDocument(
  pathOrName: string | null | undefined,
): boolean {
  if (!pathOrName) {
    // Pathless drafts default to untitled.md writing surface.
    return true;
  }
  const base = pathOrName.split(/[/\\]/).pop() ?? pathOrName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    // No extension: treat as plain writing surface (often pathless rename).
    return true;
  }
  const ext = base.slice(dot + 1).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext);
}

/**
 * Resolve the visual L Mode state for the active document before rendering.
 * This prevents a CSS/HTML tab from mounting through the Markdown parser
 * during the later preference-reset effect.
 */
export function isLModeEnabledForDocument(
  lModeEnabled: boolean,
  pathOrName: string | null | undefined,
): boolean {
  return lModeEnabled && isLModeSupportedDocument(pathOrName);
}
