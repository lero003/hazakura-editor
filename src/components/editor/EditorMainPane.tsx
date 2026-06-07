import type { RefObject } from "react";
import EditorPane, {
  type EditorPaneHandle,
  type EditorSelectionInfo,
} from "./EditorPane";
import { ImagePreviewPane } from "./preview/ImagePreviewPane";
import { ScrollPositionHud } from "./ScrollPositionHud";
import { StartPanel } from "../workspace/StartPanel";
import type { LModeCopy, SafeEditorCopy, SlashMenuCopy } from "../../lib/locale";
import type {
  BaseTheme,
  EditorSettings,
  EditorTab,
  ImagePreviewState,
  MarkdownHeadingContext,
  MenuLanguage,
  RecentEntry,
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
  imagePreviewTitle: string;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onChange: (nextValue: string) => void;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onOpenRecentFile: (path: string) => void;
  onPasteImage: (
    dataBase64: string,
    fileName: string,
  ) => Promise<string | null>;
  onScrollRatioChange: (ratio: number) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onSendToAgent: (text: string) => void;
  onTogglePinRecentFile: (path: string) => void;
  pinnedFiles: RecentEntry[];
  recentFiles: RecentEntry[];
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
  imagePreviewTitle,
  lModeCopy,
  menuLanguage,
  onChange,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFile,
  onPasteImage,
  onScrollRatioChange,
  onSelectionChange,
  onSendToAgent,
  onTogglePinRecentFile,
  pinnedFiles,
  recentFiles,
  scrollHudContext,
  scrollHudLine,
  scrollHudVisible,
  searchMatches,
  selectedImage,
  slashCommands,
  slashMenuCopy,
  workspaceRootPath,
}: EditorMainPaneProps) {
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
          {scrollHudVisible && scrollHudContext.current ? (
            <ScrollPositionHud
              context={scrollHudContext}
              line={scrollHudLine}
              menuLanguage={menuLanguage}
              totalLines={activeDocumentLineCount}
            />
          ) : null}
        </>
      ) : selectedImage ? (
        <ImagePreviewPane image={selectedImage} title={imagePreviewTitle} />
      ) : (
        <StartPanel
          copy={copy}
          onNewFile={onNewFile}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onOpenRecentFile={onOpenRecentFile}
          onTogglePinRecentFile={onTogglePinRecentFile}
          pinnedFiles={pinnedFiles}
          recentFiles={recentFiles}
        />
      )}
    </div>
  );
}
