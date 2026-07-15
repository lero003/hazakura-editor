/**
 * v1.12 OKF starter scaffold templates.
 *
 * Template **structure and body text** live under
 * `scaffoldTemplates/assets/` as ordinary Markdown files so they can be
 * rewritten without changing the write pipeline. This module only registers
 * ids, default folder names, and which asset maps to which relative path.
 *
 * Spec pin is shared with the review model (`OKF_SPEC_*` / docs/okf-spec-pin.md).
 * When the pin moves, rewrite assets **and** the integrity model together.
 * Templates are fixed starters — not formal OKF certification.
 */

import { OKF_SPEC_COMMIT } from "./types";

import minimalIndex from "./scaffoldTemplates/assets/minimal/index.md?raw";
import minimalFirstNote from "./scaffoldTemplates/assets/minimal/notes/first-note.md?raw";
import minimalLog from "./scaffoldTemplates/assets/minimal/log.md?raw";
import bookIndex from "./scaffoldTemplates/assets/book-like/index.md?raw";
import bookMorning from "./scaffoldTemplates/assets/book-like/chapters/01-morning.md?raw";
import bookAfternoon from "./scaffoldTemplates/assets/book-like/chapters/02-afternoon.md?raw";
import bookCharacters from "./scaffoldTemplates/assets/book-like/notes/characters.md?raw";
import bookLog from "./scaffoldTemplates/assets/book-like/log.md?raw";

export type OkfScaffoldTemplateId = "minimal" | "book-like";

export type OkfScaffoldFile = {
  relativePath: string;
  contents: string;
};

export type OkfScaffoldTemplate = {
  id: OkfScaffoldTemplateId;
  /** Default folder basename under the selected parent. */
  defaultFolderName: string;
  /** Preferred file to open after create (bundle-relative). */
  openRelativePath: string;
  files: OkfScaffoldFile[];
};

export const OKF_SCAFFOLD_SPEC_COMMIT = OKF_SPEC_COMMIT;

/** Ensure Markdown assets end with a single trailing newline when written. */
function normalizeAsset(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

function files(
  entries: ReadonlyArray<readonly [relativePath: string, raw: string]>,
): OkfScaffoldFile[] {
  return entries.map(([relativePath, raw]) => ({
    relativePath,
    contents: normalizeAsset(raw),
  }));
}

/**
 * Registry of built-in starters. To change wording or layout later:
 * edit the Markdown under `scaffoldTemplates/assets/`, or add a new id
 * here with additional `?raw` imports. User-defined templates remain
 * out of scope for v1.12.
 */
const TEMPLATES: Record<OkfScaffoldTemplateId, OkfScaffoldTemplate> = {
  minimal: {
    id: "minimal",
    defaultFolderName: "知識フォルダ",
    openRelativePath: "index.md",
    files: files([
      ["index.md", minimalIndex],
      ["notes/first-note.md", minimalFirstNote],
      ["log.md", minimalLog],
    ]),
  },
  "book-like": {
    id: "book-like",
    defaultFolderName: "OKF互換の本",
    openRelativePath: "index.md",
    files: files([
      ["index.md", bookIndex],
      ["chapters/01-morning.md", bookMorning],
      ["chapters/02-afternoon.md", bookAfternoon],
      ["notes/characters.md", bookCharacters],
      ["log.md", bookLog],
    ]),
  },
};

export function listOkfScaffoldTemplateIds(): OkfScaffoldTemplateId[] {
  return ["minimal", "book-like"];
}

export function getOkfScaffoldTemplate(
  id: OkfScaffoldTemplateId,
): OkfScaffoldTemplate {
  return TEMPLATES[id];
}

export function isOkfScaffoldTemplateId(
  value: string,
): value is OkfScaffoldTemplateId {
  return value === "minimal" || value === "book-like";
}
