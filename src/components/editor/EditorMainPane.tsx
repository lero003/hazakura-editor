import type { RefObject } from "react";
import EditorPane, {
  type EditorPaneHandle,
  type EditorSelectionInfo,
} from "./EditorPane";
import { ImagePreviewPane } from "./preview/ImagePreviewPane";
import { ScrollPositionHud } from "./ScrollPositionHud";
import { CopyIcon } from "../app/Icons";
import { StartPanel } from "../workspace/StartPanel";
import { writeTextToClipboard } from "../../lib/clipboard";
import type { LModeCopy, SafeEditorCopy, SlashMenuCopy } from "../../lib/locale";
import type {
  BaseTheme,
  AppleAssistGenerationLock,
  EditorSettings,
  EditorTab,
  ImagePreviewState,
  MarkdownHeadingContext,
  MenuLanguage,
  TextMatch,
} from "../../types";
import type { SlashCommand } from "../../types/slash";

type EditorMainPaneProps = {
  activeContents: string;
  activeDocumentLineCount: number;
  activeSearchMatchIndex: number;
  activeTab: EditorTab | null;
  copy: SafeEditorCopy;
  documentKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  editorSettings: EditorSettings;
  editorTheme: BaseTheme;
  generationLock?: AppleAssistGenerationLock | null;
  imagePreviewTitle: string;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onChange: (nextValue: string) => void;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onPasteImage: (
    dataBase64: string,
    fileName: string,
  ) => Promise<string | null>;
  onScrollRatioChange: (ratio: number) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onSendToAgent: (text: string) => void;
  restoreComplete: boolean;
  scrollHudContext: MarkdownHeadingContext;
  scrollHudLine: number;
  scrollHudVisible: boolean;
  searchMatches: TextMatch[];
  selectedImage: ImagePreviewState | null;
  slashCommands: readonly SlashCommand[];
  slashMenuCopy: SlashMenuCopy;
  workspaceRootPath: string | null;
};

export function EditorMainPane({
  activeContents,
  activeDocumentLineCount,
  activeSearchMatchIndex,
  activeTab,
  copy,
  documentKey,
  editorPaneRef,
  editorSettings,
  editorTheme,
  generationLock = null,
  imagePreviewTitle,
  lModeCopy,
  menuLanguage,
  onChange,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onPasteImage,
  onScrollRatioChange,
  onSelectionChange,
  onSendToAgent,
  restoreComplete,
  scrollHudContext,
  scrollHudLine,
  scrollHudVisible,
  searchMatches,
  selectedImage,
  slashCommands,
  slashMenuCopy,
  workspaceRootPath,
}: EditorMainPaneProps) {
  const showDocumentPathBar =
    activeTab !== null &&
    activeTab.path.length > 0 &&
    !editorSettings.lModeEnabled;
  const copyFullPathLabel = activeTab
    ? formatCopyFullPathLabel(menuLanguage, activeTab.path)
    : "";
  const appleAssistLocked = generationLock !== null;

  return (
    <div className="pane editor-pane" aria-label="Editor">
      {activeTab ? (
        <>
          <EditorPane
            ref={editorPaneRef}
            activeSearchMatchIndex={activeSearchMatchIndex}
            documentKey={documentKey}
            fontSize={editorSettings.editorFontSize}
            lModeEnabled={editorSettings.lModeEnabled}
            lModeCopy={lModeCopy}
            lModeTypewriter={editorSettings.lModeTypewriter}
            onChange={onChange}
            onScrollRatioChange={onScrollRatioChange}
            readOnly={appleAssistLocked}
            onSelectionChange={onSelectionChange}
            searchMatches={searchMatches}
            showInvisibles={editorSettings.showInvisibles}
            slashCommands={slashCommands}
            slashMenuCopy={slashMenuCopy}
            spellcheckEnabled={editorSettings.spellcheckEnabled}
            tabSize={editorSettings.tabSize}
            theme={editorTheme}
            value={activeContents}
            wrapLines={editorSettings.wrapLines}
            workspaceRoot={workspaceRootPath ?? undefined}
            onSendToAgent={onSendToAgent}
            onPasteImage={onPasteImage}
          />
          {appleAssistLocked ? (
            <div
              aria-live="polite"
              className="editor-apple-assist-lock"
              role="status"
            >
              <strong>Hazakura Local Assist が生成中です</strong>
              <span>本文は表示できますが、編集は一時停止しています。</span>
            </div>
          ) : null}
          {scrollHudVisible && scrollHudContext.current ? (
            <ScrollPositionHud
              context={scrollHudContext}
              line={scrollHudLine}
              menuLanguage={menuLanguage}
              totalLines={activeDocumentLineCount}
            />
          ) : null}
          {showDocumentPathBar ? (
            <button
              aria-label={copyFullPathLabel}
              className="editor-document-path-bar"
              onClick={() => {
                void writeTextToClipboard(activeTab.path).catch(() => undefined);
              }}
              title={activeTab.path}
              type="button"
            >
              <span className="editor-document-full-path">{activeTab.path}</span>
              <span className="editor-document-path-copy-icon" aria-hidden="true">
                <CopyIcon />
              </span>
            </button>
          ) : null}
        </>
      ) : selectedImage ? (
        <ImagePreviewPane image={selectedImage} title={imagePreviewTitle} />
      ) : !restoreComplete ? (
        <div className="editor-restore-loading" aria-hidden="true">
          <span className="editor-restore-loading-line" />
          <span className="editor-restore-loading-line" />
          <span className="editor-restore-loading-line" />
          <span className="editor-restore-loading-line" />
        </div>
      ) : (
        <StartPanel
          copy={copy}
          onNewFile={onNewFile}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
        />
      )}
    </div>
  );
}

function formatCopyFullPathLabel(
  menuLanguage: MenuLanguage,
  documentPath: string,
): string {
  switch (menuLanguage) {
    case "ja":
      return `フルパスをコピー: ${documentPath}`;
    case "en":
    default:
      return `Copy full path: ${documentPath}`;
  }
}
