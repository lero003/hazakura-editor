import type { RecentEntry, MenuLanguage } from "../types";
import type { EditableLineEnding, MarkdownHeading } from "../types";
import { isJapaneseMenuLanguage } from "../types";
import { isKanaStyle } from "./locale/_helpers";

// ── Recent Entries ──

export function parentFolderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);

  return parts.length >= 2 ? parts[parts.length - 2] : path;
}

export function buildRecentDisplayEntries(
  entries: RecentEntry[],
): Array<RecentEntry & { displayLabel: string }> {
  const labelCounts = new Map<string, number>();

  for (const entry of entries) {
    labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);
  }

  return entries.map((entry) => ({
    ...entry,
    displayLabel:
      (labelCounts.get(entry.label) ?? 0) > 1
        ? `${entry.label} - ${parentFolderName(entry.path)}`
        : entry.label,
  }));
}

// ── Path Helpers ──

export function fileNameFromPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);

  return fileName || path;
}

export function folderLabelFromPath(path: string): string {
  const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const slashIndex = normalizedPath.lastIndexOf("/");
  const folderName =
    slashIndex === -1 ? normalizedPath : normalizedPath.slice(slashIndex + 1);

  return folderName || normalizedPath || path;
}

export function suggestedNewFilePath(
  workspaceRootPath: string | null,
): string | null {
  return workspaceRootPath
    ? `${workspaceRootPath}/untitled.md`
    : "untitled.md";
}

export function suggestedSaveAsPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex === -1 ? "" : path.slice(0, slashIndex + 1);
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${directory}${fileName}-copy`;
  }

  return `${directory}${fileName.slice(0, dotIndex)}-copy${fileName.slice(dotIndex)}`;
}

export function normalizeAbsolutePath(path: string): string {
  const parts: string[] = [];
  const isAbsolute = path.startsWith("/");

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (parts.length === 0) {
        return isAbsolute ? "/" : "";
      }

      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return `${isAbsolute ? "/" : ""}${parts.join("/")}`;
}

export function directoryPathFromPath(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  const separatorIndex = normalized.lastIndexOf("/");

  if (separatorIndex <= 0) {
    return "/";
  }

  return normalized.slice(0, separatorIndex);
}

export function isPathInsideDirectory(
  path: string,
  directoryPath: string,
): boolean {
  const normalizedPath = normalizeAbsolutePath(path);
  const normalizedDirectory = normalizeAbsolutePath(directoryPath);

  return (
    normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

// ── Image Extension Helpers ──

export function isSupportedImageFile(path: string): boolean {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";

  return ["png", "jpg", "jpeg", "gif", "webp"].includes(extension);
}


// ── Line Ending Helpers ──

export function normalizeTextLineEndings(
  contents: string,
  lineEnding: EditableLineEnding,
): string {
  const lfContents = contents.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (lineEnding === "lf") {
    return lfContents;
  }

  return lfContents.replace(/\n/g, "\r\n");
}


export function isMarkdownDocumentPath(path: string): boolean {
  const lowerName = fileNameFromPath(path).toLowerCase();
  const extension = lowerName.includes(".")
    ? lowerName.split(".").at(-1) ?? ""
    : "";

  return ["md", "markdown", "mdown"].includes(extension);
}

export function parseMarkdownHeadingLine(
  line: string,
  lineNumber: number,
): MarkdownHeading | null {
  const headingMatch = line.match(/^(#{1,6})[ \t]+(.+?)\s*$/);

  if (!headingMatch) {
    return null;
  }

  const text = headingMatch[2].replace(/[ \t]+#+[ \t]*$/, "").trim();

  if (!text) {
    return null;
  }

  return {
    level: headingMatch[1].length,
    line: lineNumber,
    text,
  };
}

export function findCurrentMarkdownHeading(
  headings: MarkdownHeading[],
  line: number,
): MarkdownHeading | null {
  let currentHeading: MarkdownHeading | null = null;

  for (const heading of headings) {
    if (heading.line > line) {
      break;
    }

    currentHeading = heading;
  }

  return currentHeading;
}

export function localizeCompareError(
  message: string,
  menuLanguage: MenuLanguage = "en",
): string {
  const matched = message.includes(
    "Compare stopped because these files are too large for the comparison preview.",
  );

  if (!matched) {
    return message;
  }

  if (isKanaStyle(menuLanguage)) {
    return "ふみが おおきすぎるため、くらべ ぷれびゅーを ていし しました。";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "ファイルが大きすぎるため、比較プレビューを停止しました。";
  }
  return message;
}

// ── Number Helpers ──

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

// ── General Helpers ──

export function isEditorKeyboardTarget(
  element: EventTarget | null,
): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  if (element.classList.contains("cm-editor")) {
    return true;
  }

  const parent = element.closest(".cm-editor");

  return parent !== null;
}

export function trapFocusInElement(
  element: HTMLElement | null,
  event: KeyboardEvent,
): void {
  if (!element) {
    return;
  }

  const focusableSelectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  const focusableElements = Array.from(
    element.querySelectorAll<HTMLElement>(focusableSelectors.join(", ")),
  ).filter(
    (focusableElement) =>
      focusableElement.tabIndex >= 0 &&
      focusableElement.offsetParent !== null,
  );

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const currentIndex = focusableElements.indexOf(
    document.activeElement as HTMLElement,
  );
  const isShiftTab = event.shiftKey;

  if (isShiftTab && currentIndex <= 0) {
    event.preventDefault();
    focusableElements[focusableElements.length - 1].focus();
    return;
  }

  if (!isShiftTab && currentIndex >= focusableElements.length - 1) {
    event.preventDefault();
    focusableElements[0].focus();
    return;
  }
}
