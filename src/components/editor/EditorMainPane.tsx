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
import type {
  AppleAssistCopy,
  LModeCopy,
  RecoveryCopy,
  SafeEditorCopy,
  SlashMenuCopy,
} from "../../lib/locale";
import type {
  BaseTheme,
  AppleAssistGenerationLock,
  DraftRecord,
  EditorSettings,
  EditorTab,
  ImagePreviewState,
  MarkdownHeadingContext,
  MenuLanguage,
  RecentEntry,
  TextMatch,
} from "../../types";
import type { SlashCommand } from "../../types/slash";
import type {
  EditorViewState,
  EditorViewStatePatch,
} from "../../features/editor/documentViewState";

type EditorMainPaneProps = {
  activeContents: string;
  activeDocumentLineCount: number;
  activeSearchMatchIndex: number;
  activeTab: EditorTab | null;
  appleAssistCopy: AppleAssistCopy;
  copy: SafeEditorCopy;
  documentKey: string;
  editorSessionKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  editorSettings: EditorSettings;
  editorTheme: BaseTheme;
  editorViewState: EditorViewState | null;
  generationLock?: AppleAssistGenerationLock | null;
  imagePreviewTitle: string;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onChange: (nextValue: string) => void;
  onEditorViewStateChange: (patch: EditorViewStatePatch) => void;
  onDiscardDraft?: (draftPathOrKey: string) => void;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onOpenRecentWorkspace?: (path: string) => void | Promise<void>;
  onPasteImage: (
    dataBase64: string,
    fileName: string,
  ) => Promise<string | null>;
  onReopenPersistedWorkspace?: () => void | Promise<void>;
  onRestoreDraft?: (draft: DraftRecord) => void;
  onScrollRatioChange: (ratio: number) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onSendToAgent: (text: string) => void;
  pathlessDrafts?: DraftRecord[];
  recentWorkspaces?: RecentEntry[];
  recoveryCopy?: RecoveryCopy;
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
  appleAssistCopy,
  copy,
  documentKey,
  editorSessionKey,
  editorPaneRef,
  editorSettings,
  editorTheme,
  editorViewState,
  generationLock = null,
  imagePreviewTitle,
  lModeCopy,
  menuLanguage,
  onChange,
  onDiscardDraft,
  onEditorViewStateChange,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentWorkspace,
  onPasteImage,
  onReopenPersistedWorkspace,
  onRestoreDraft,
  onScrollRatioChange,
  onSelectionChange,
  onSendToAgent,
  pathlessDrafts = [],
  recentWorkspaces = [],
  recoveryCopy,
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
    <div className="pane editor-pane" aria-label={copy.editor}>
      {activeTab ? (
        <>
          <EditorPane
            ref={editorPaneRef}
            activeSearchMatchIndex={activeSearchMatchIndex}
            documentKey={documentKey}
            editorSessionKey={editorSessionKey}
            editorViewState={editorViewState}
            fontSize={editorSettings.editorFontSize}
            lModeEnabled={editorSettings.lModeEnabled}
            lModeCopy={lModeCopy}
            lModeTypewriter={editorSettings.lModeTypewriter}
            onChange={onChange}
            onEditorViewStateChange={onEditorViewStateChange}
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
              <strong>{appleAssistCopy.generationInProgressTitle}</strong>
              <span>{appleAssistCopy.generationInProgressMessage}</span>
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
          liveWorkspaceRootPath={workspaceRootPath}
          onDiscardDraft={onDiscardDraft}
          onNewFile={onNewFile}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onOpenRecentWorkspace={onOpenRecentWorkspace}
          onReopenPersistedWorkspace={onReopenPersistedWorkspace}
          onRestoreDraft={onRestoreDraft}
          pathlessDrafts={pathlessDrafts}
          recentWorkspaces={recentWorkspaces}
          recoveryCopy={recoveryCopy}
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
    case "kana":
      return `ふるぱすを こぴー: ${documentPath}`;
    case "ja":
      return `フルパスをコピー: ${documentPath}`;
    case "en":
    default:
      return `Copy full path: ${documentPath}`;
  }
}
