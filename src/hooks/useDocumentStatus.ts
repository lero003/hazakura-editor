import { useMemo } from "react";
import type {
  CompareCase,
  CompareViewState,
  EditableLineEnding,
  EditorTab,
  ImagePreviewState,
  LineEndingKind,
  MarkdownHeading,
  MenuLanguage,
  RightPaneMode,
  TextDocumentStats,
} from "../types";
import { normalizeTextLineEndings } from "../utils";

type SelectionInfo = {
  column: number;
  line: number;
  selectedCharacters: number;
  selectedLines: number;
};

type UseDocumentStatusParams = {
  activeContents: string;
  activeDirty: boolean;
  activeTab: EditorTab | null;
  compareCase: CompareCase | null;
  compareView: CompareViewState | null;
  currentMarkdownHeading: MarkdownHeading | null;
  menuLanguage: MenuLanguage;
  noFileOpenText: string;
  selectedImage: ImagePreviewState | null;
  selectionInfo: SelectionInfo;
  sidePaneMode: RightPaneMode | null;
};

export function useDocumentStatus({
  activeContents,
  activeDirty,
  activeTab,
  compareCase,
  compareView,
  currentMarkdownHeading,
  menuLanguage,
  noFileOpenText,
  selectedImage,
  selectionInfo,
  sidePaneMode,
}: UseDocumentStatusParams) {
  const lineCount = useMemo(
    () => countDocumentLines(activeContents),
    [activeContents],
  );
  const stats = useMemo(
    () => analyzeTextDocument(activeContents, activeTab?.line_ending),
    [activeContents, activeTab?.line_ending],
  );
  const compareMeta = sidePaneMode === "compare" && compareView
    ? menuLanguage === "ja"
      ? `${compareCase?.kind === "changes" ? "変更確認" : "比較"} · ${compareView.additions} 追加 · ${compareView.removals} 削除`
      : `${compareCase?.kind === "changes" ? "Change review" : "Comparison"} · ${compareView.additions} added · ${compareView.removals} removed`
    : null;
  const documentMeta = activeTab
    ? formatActiveDocumentMeta(stats, activeTab, activeDirty, menuLanguage)
    : selectedImage
      ? menuLanguage === "ja"
        ? `画像 · ${formatBytes(selectedImage.size)} · ${selectedImage.name}`
        : `Image · ${formatBytes(selectedImage.size)} · ${selectedImage.name}`
      : noFileOpenText;
  const statusDetail = compareMeta
    ? compareMeta
    : activeTab
      ? formatActiveEditorStatusDetail(
          documentMeta,
          selectionInfo,
          currentMarkdownHeading,
          menuLanguage,
        )
      : documentMeta;

  return {
    documentMeta,
    lineCount,
    stats,
    statusDetail,
  };
}

function countDocumentLines(source: string): number {
  return source.split(/\r\n|\n|\r/).length;
}

function analyzeTextDocument(
  contents: string,
  savedLineEnding?: EditableLineEnding,
): TextDocumentStats {
  const counts = countLineEndings(contents);
  const byteContents = savedLineEnding
    ? normalizeTextLineEndings(contents, savedLineEnding)
    : contents;

  return {
    bytes: new TextEncoder().encode(byteContents).length,
    characters: Array.from(contents).length,
    lineEnding: savedLineEnding ?? summarizeLineEndings(counts),
    hasFinalNewline: contents.endsWith("\n") || contents.endsWith("\r"),
  };
}

function countLineEndings(contents: string) {
  let crlf = 0;
  let lf = 0;
  let cr = 0;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    const nextChar = contents[index + 1];

    if (char === "\r" && nextChar === "\n") {
      crlf += 1;
      index += 1;
    } else if (char === "\n") {
      lf += 1;
    } else if (char === "\r") {
      cr += 1;
    }
  }

  return { crlf, lf, cr };
}

function summarizeLineEndings({
  crlf,
  lf,
  cr,
}: {
  crlf: number;
  lf: number;
  cr: number;
}): LineEndingKind {
  const usedKinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length;

  if (usedKinds === 0) {
    return "none";
  }

  if (usedKinds > 1 || cr > 0) {
    return "mixed";
  }

  return crlf > 0 ? "crlf" : "lf";
}

function formatActiveDocumentMeta(
  stats: TextDocumentStats,
  tab: EditorTab,
  dirty: boolean,
  menuLanguage: MenuLanguage,
): string {
  return [
    ...formatDocumentMetaParts(stats, tab.name, menuLanguage),
    tab.large_file_warning
      ? menuLanguage === "ja"
        ? "大きなファイル"
        : "large file"
      : null,
    dirty
      ? menuLanguage === "ja"
        ? "未保存"
        : "unsaved"
      : menuLanguage === "ja"
        ? "保存済み"
        : "clean",
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function formatDocumentMetaParts(
  stats: TextDocumentStats,
  fileName: string,
  menuLanguage: MenuLanguage,
): string[] {
  return [
    formatFileType(fileName, menuLanguage),
    "UTF-8",
    formatBytes(stats.bytes),
    menuLanguage === "ja"
      ? `${stats.characters.toLocaleString()} 文字`
      : `${stats.characters.toLocaleString()} chars`,
    formatLineEndingKind(stats.lineEnding, menuLanguage),
    stats.hasFinalNewline
      ? menuLanguage === "ja"
        ? "末尾改行あり"
        : "final newline"
      : menuLanguage === "ja"
        ? "末尾改行なし"
        : "no final newline",
  ];
}

function formatFileType(fileName: string, menuLanguage: MenuLanguage): string {
  const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";

  switch (extension) {
    case "md":
    case "markdown":
    case "mdown":
      return "Markdown";
    case "txt":
    case "text":
    case "log":
      return "Text";
    case "json":
    case "jsonl":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "toml":
      return "TOML";
    case "csv":
    case "tsv":
      return menuLanguage === "ja" ? "区切りテキスト" : "Delimited text";
    case "html":
    case "xml":
      return menuLanguage === "ja" ? "マークアップ" : "Markup";
    case "css":
      return "CSS";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "JavaScript";
    case "ts":
    case "tsx":
      return "TypeScript";
    case "ini":
    case "conf":
      return menuLanguage === "ja" ? "設定" : "Config";
    default:
      return extension
        ? extension.toUpperCase()
        : menuLanguage === "ja"
          ? "プレーンテキスト"
          : "Plain text";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSelectionInfo(
  selection: SelectionInfo,
  menuLanguage: MenuLanguage,
): string {
  const selectionText =
    selection.selectedCharacters > 0
      ? menuLanguage === "ja"
        ? ` · ${selection.selectedCharacters.toLocaleString()} 文字選択 / ${selection.selectedLines.toLocaleString()} 行`
        : ` · ${selection.selectedCharacters.toLocaleString()} selected / ${selection.selectedLines.toLocaleString()} lines`
      : "";

  return menuLanguage === "ja"
    ? `${selection.line.toLocaleString()} 行, ${selection.column.toLocaleString()} 列${selectionText}`
    : `Ln ${selection.line.toLocaleString()}, Col ${selection.column.toLocaleString()}${selectionText}`;
}

function formatActiveEditorStatusDetail(
  documentMeta: string,
  selection: SelectionInfo,
  currentHeading: MarkdownHeading | null,
  menuLanguage: MenuLanguage,
): string {
  const parts = [documentMeta, formatSelectionInfo(selection, menuLanguage)];

  if (currentHeading) {
    parts.push(
      menuLanguage === "ja"
        ? `現在位置: § ${currentHeading.text}`
        : `Position: § ${currentHeading.text}`,
    );
  }

  return parts.join(" · ");
}

export function formatLineEndingKind(
  lineEnding: LineEndingKind,
  menuLanguage: MenuLanguage = "en",
): string {
  if (lineEnding === "crlf") {
    return "CRLF";
  }

  if (lineEnding === "mixed") {
    return menuLanguage === "ja" ? "混在" : "Mixed";
  }

  if (lineEnding === "none") {
    return menuLanguage === "ja" ? "改行なし" : "No line endings";
  }

  return "LF";
}
