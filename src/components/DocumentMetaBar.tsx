import type { MarkdownFormat } from "./EditorPane";
import { LinkIcon, TableIcon } from "./Icons";
import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import type { EditorChromeCopy } from "../locale";
import type { EditableLineEnding, EditorTab } from "../types";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentAvailable: boolean;
  agentPaneActive: boolean;
  copy: EditorChromeCopy;
  diffPaneActive: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  onInsertTable: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onToggleAgent: () => void;
  onToggleDiff: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  outlinePaneActive: boolean;
  previewPaneActive: boolean;
  recoveryReviewChangesLabel: string;
  sidePaneCopy: RightPaneToggleCopy;
};

export function DocumentMetaBar({
  activeDirty,
  activeTab,
  agentAvailable,
  agentPaneActive,
  copy,
  diffPaneActive,
  onApplyMarkdownFormat,
  onConvertLineEnding,
  onInsertTable,
  onReviewChanges,
  onToggleAgent,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  outlinePaneActive,
  previewPaneActive,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  return (
    <div className="document-meta">
      {activeTab ? (
        <div className="markdown-assist" aria-label={copy.markdownHelpers}>
          <button
            aria-label={copy.strong}
            className="markdown-assist-button strong"
            onClick={() => onApplyMarkdownFormat("bold")}
            title={copy.strongTitle}
            type="button"
          >
            B
          </button>
          <button
            aria-label={copy.italic}
            className="markdown-assist-button italic"
            onClick={() => onApplyMarkdownFormat("italic")}
            title={copy.italicTitle}
            type="button"
          >
            I
          </button>
          <button
            aria-label={copy.inlineCode}
            className="markdown-assist-button code"
            onClick={() => onApplyMarkdownFormat("code")}
            title={copy.inlineCodeTitle}
            type="button"
          >
            `
          </button>
          <button
            aria-label={copy.link}
            className="markdown-assist-button"
            onClick={() => onApplyMarkdownFormat("link")}
            title={copy.linkTitle}
            type="button"
          >
            <LinkIcon />
          </button>
          <button
            aria-label="Insert Table"
            className="markdown-assist-button"
            onClick={onInsertTable}
            title="Insert Table (⌘⇧T)"
            type="button"
          >
            <TableIcon />
          </button>
        </div>
      ) : null}
      <RightPaneToggleControls
        agentAvailable={agentAvailable}
        agentActive={agentPaneActive}
        copy={sidePaneCopy}
        diffActive={diffPaneActive}
        diffAvailable
        onToggleDiff={onToggleDiff}
        onToggleAgent={onToggleAgent}
        onToggleOutline={onToggleOutline}
        onTogglePreview={onTogglePreview}
        outlineActive={outlinePaneActive}
        outlineAvailable={activeTab !== null}
        previewActive={previewPaneActive}
      />
      {activeDirty && activeTab ? (
        <button
          className="review-changes-button"
          onClick={() => onReviewChanges(activeTab)}
          type="button"
        >
          {recoveryReviewChangesLabel}
        </button>
      ) : null}
      {activeTab ? (
        <label className="line-ending-compact">
          <span>{copy.lineEnding}</span>
          <select
            aria-label={copy.lineEndings}
            value={activeTab.line_ending}
            onChange={(event) =>
              onConvertLineEnding(event.target.value as EditableLineEnding)
            }
          >
            <option value="lf">LF</option>
            <option value="crlf">CRLF</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}
