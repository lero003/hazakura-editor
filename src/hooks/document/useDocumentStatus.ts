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
  TextEncoding,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import { normalizeTextLineEndings } from "../../lib/utils";
import { formatLineEndingKind, formatTextEncoding } from "../../lib/format";

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
    ? isKanaStyle(menuLanguage)
      ? `${compareCase?.kind === "changes" ? "へんこう かくにん" : "くらべ"} · ${compareView.additions} ついか · ${compareView.removals} さくじょ`
      : isJapaneseMenuLanguage(menuLanguage)
        ? `${compareCase?.kind === "changes" ? "変更確認" : "比較"} · ${compareView.additions} 追加 · ${compareView.removals} 削除`
        : `${compareCase?.kind === "changes" ? "Change review" : "Comparison"} · ${compareView.additions} added · ${compareView.removals} removed`
    : null;
  const documentMetaParts = activeTab
    ? formatActiveDocumentMeta(stats, activeTab, activeDirty, menuLanguage)
    : selectedImage
      ? {
          meta: `${localizeImageLabel(menuLanguage)} · ${formatBytes(selectedImage.size)} · ${selectedImage.name}`,
          secondaryMeta: "",
          dirtyLabel: "",
        }
      : { meta: noFileOpenText, secondaryMeta: "", dirtyLabel: "" };
  const statusMetadata = compareMeta
    ? { primary: compareMeta, secondary: "" }
    : activeTab
      ? formatActiveEditorStatusMetadata(
          documentMetaParts.meta,
          documentMetaParts.secondaryMeta,
          selectionInfo,
          currentMarkdownHeading,
          menuLanguage,
        )
      : { primary: documentMetaParts.meta, secondary: documentMetaParts.secondaryMeta };

  return {
    documentMeta: documentMetaParts.meta,
    dirtyLabel: documentMetaParts.dirtyLabel,
    lineCount,
    stats,
    statusDetail: statusMetadata.primary,
    statusSecondaryDetail: statusMetadata.secondary,
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
): { meta: string; secondaryMeta: string; dirtyLabel: string } {
  const [
    fileType,
    encoding,
    bytes,
    characters,
    lineEnding,
    finalNewline,
  ] = formatDocumentMetaParts(stats, tab.name, tab.encoding, menuLanguage);
  const largeFile = tab.large_file_warning
    ? localizeLargeFileLabel(menuLanguage)
    : null;
  const meta = [fileType, bytes, characters, largeFile]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const secondaryMeta = [encoding, lineEnding, finalNewline].join(" · ");
  const dirtyLabel = dirty
    ? localizeUnsavedLabel(menuLanguage)
    : "";
  return { meta, secondaryMeta, dirtyLabel };
}

function formatDocumentMetaParts(
  stats: TextDocumentStats,
  fileName: string,
  encoding: TextEncoding,
  menuLanguage: MenuLanguage,
): string[] {
  return [
    formatFileType(fileName, menuLanguage),
    formatTextEncoding(encoding, menuLanguage),
    formatBytes(stats.bytes),
    localizeCharactersCountLabel(menuLanguage, stats.characters),
    formatLineEndingKind(stats.lineEnding, menuLanguage),
    stats.hasFinalNewline
      ? localizeFinalNewlineLabel(menuLanguage)
      : localizeNoFinalNewlineLabel(menuLanguage),
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
      return isKanaStyle(menuLanguage)
        ? "くぎり もじ"
        : isJapaneseMenuLanguage(menuLanguage)
          ? "区切りテキスト"
          : "Delimited text";
    case "html":
    case "xml":
      return isKanaStyle(menuLanguage)
        ? "まーくあっぷ"
        : isJapaneseMenuLanguage(menuLanguage)
          ? "マークアップ"
          : "Markup";
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
      return isKanaStyle(menuLanguage)
        ? "せってい"
        : isJapaneseMenuLanguage(menuLanguage)
          ? "設定"
          : "Config";
    default:
      return extension
        ? extension.toUpperCase()
        : isKanaStyle(menuLanguage)
          ? "ぷれいん もじ"
          : isJapaneseMenuLanguage(menuLanguage)
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
      ? isKanaStyle(menuLanguage)
        ? ` · ${selection.selectedCharacters.toLocaleString()} もじ せんたく / ${selection.selectedLines.toLocaleString()} ぎょう`
        : isJapaneseMenuLanguage(menuLanguage)
          ? ` · ${selection.selectedCharacters.toLocaleString()} 文字選択 / ${selection.selectedLines.toLocaleString()} 行`
          : ` · ${selection.selectedCharacters.toLocaleString()} selected / ${selection.selectedLines.toLocaleString()} lines`
      : "";

  if (isKanaStyle(menuLanguage)) {
    return `${selection.line.toLocaleString()} ぎょう, ${selection.column.toLocaleString()} れつ${selectionText}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `${selection.line.toLocaleString()} 行, ${selection.column.toLocaleString()} 列${selectionText}`;
  }
  return `Ln ${selection.line.toLocaleString()}, Col ${selection.column.toLocaleString()}${selectionText}`;
}

function formatActiveEditorStatusMetadata(
  primaryMeta: string,
  secondaryMeta: string,
  selection: SelectionInfo,
  currentHeading: MarkdownHeading | null,
  menuLanguage: MenuLanguage,
): { primary: string; secondary: string } {
  const secondaryParts = [secondaryMeta, formatSelectionInfo(selection, menuLanguage)];

  if (currentHeading) {
    secondaryParts.push(
      isKanaStyle(menuLanguage)
        ? `げんざいいち: § ${currentHeading.text}`
        : isJapaneseMenuLanguage(menuLanguage)
          ? `現在位置: § ${currentHeading.text}`
          : `Position: § ${currentHeading.text}`,
    );
  }

  return {
    primary: primaryMeta,
    secondary: secondaryParts.filter(Boolean).join(" · "),
  };
}

function localizeImageLabel(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) return "がぞう";
  if (isJapaneseMenuLanguage(menuLanguage)) return "画像";
  return "Image";
}

function localizeLargeFileLabel(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) return "おおきな ふみ";
  if (isJapaneseMenuLanguage(menuLanguage)) return "大きなファイル";
  return "large file";
}

function localizeUnsavedLabel(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) return "みほぞん";
  if (isJapaneseMenuLanguage(menuLanguage)) return "未保存";
  return "unsaved";
}

function localizeCharactersCountLabel(
  menuLanguage: MenuLanguage,
  count: number,
): string {
  if (isKanaStyle(menuLanguage)) return `${count.toLocaleString()} もじ`;
  if (isJapaneseMenuLanguage(menuLanguage)) return `${count.toLocaleString()} 文字`;
  return `${count.toLocaleString()} chars`;
}

function localizeFinalNewlineLabel(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) return "びょう かいぎょう あり";
  if (isJapaneseMenuLanguage(menuLanguage)) return "末尾改行あり";
  return "final newline";
}

function localizeNoFinalNewlineLabel(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) return "びょう かいぎょう なし";
  if (isJapaneseMenuLanguage(menuLanguage)) return "末尾改行なし";
  return "no final newline";
}
