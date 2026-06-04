import type {
  EditableLineEnding,
  EditorTab,
  TextEncoding,
} from "../../types";
import type { LModeCopy } from "../../lib/locale";
import { LModeClasses } from "../../features/editor/lMode";

type StatusBarProps = {
  activeTab: EditorTab | null;
  agentLabel: string | null;
  detail: string;
  encodingAriaLabel: string;
  encodingLabel: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeCopy: LModeCopy | null;
  lModeEnabled: boolean;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  onExitLModeToWorkspace: () => void;
  onReviewChangesFromLMode: () => void;
  reviewChangesAvailable: boolean;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  statusText: string;
};

export function StatusBar({
  activeTab,
  agentLabel,
  detail,
  encodingAriaLabel,
  encodingLabel,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeCopy,
  lModeEnabled,
  onConvertEncoding,
  onConvertLineEnding,
  onExitLModeToWorkspace,
  onReviewChangesFromLMode,
  reviewChangesAvailable,
  saveAffirmation,
  saveAffirmationKey,
  statusText,
}: StatusBarProps) {
  const lModeStatusLinks = lModeEnabled && lModeCopy ? (
    <span className={LModeClasses.statusLinkGroup}>
      {reviewChangesAvailable ? (
        <>
          <button
            className={LModeClasses.statusLink}
            onClick={onReviewChangesFromLMode}
            title={lModeCopy.statusBarReviewChangesTitle}
            type="button"
          >
            {lModeCopy.statusBarReviewChangesLabel}
          </button>
          <span
            aria-hidden="true"
            className={LModeClasses.statusLinkDivider}
          />
        </>
      ) : null}
      <button
        className={LModeClasses.statusLink}
        onClick={onExitLModeToWorkspace}
        title={lModeCopy.statusBarWorkspaceTitle}
        type="button"
      >
        {lModeCopy.statusBarWorkspaceLabel}
      </button>
    </span>
  ) : null;

  return (
    <footer className="status-bar">
      <span className="status-bar-segment status-bar-status">
        {saveAffirmation ? (
          <span
            aria-hidden="true"
            className="save-affirmation"
            key={saveAffirmationKey ?? "save-affirmation"}
          >
            ✓
          </span>
        ) : null}
        {statusText}
      </span>
      {agentLabel ? (
        <span className="status-bar-segment status-agent-indicator" title="Agent mode active">
          <span className="status-agent-dot" />
          {agentLabel}
        </span>
      ) : null}
      <span className="status-bar-segment status-bar-detail" title={detail}>
        {detail}
      </span>
      {lModeStatusLinks}
      {activeTab && !lModeEnabled ? (
        <span className="status-bar-format-group">
          <label className="status-bar-segment status-bar-format-chip">
            <span className="status-bar-format-label">{lineEndingLabel}</span>
            <select
              aria-label={lineEndingAriaLabel}
              className="status-bar-format-select"
              value={activeTab.line_ending}
              onChange={(event) =>
                onConvertLineEnding(event.target.value as EditableLineEnding)
              }
            >
              <option value="lf">LF</option>
              <option value="crlf">CRLF</option>
            </select>
          </label>
          <label className="status-bar-segment status-bar-format-chip">
            <span className="status-bar-format-label">{encodingLabel}</span>
            <select
              aria-label={encodingAriaLabel}
              className="status-bar-format-select"
              value={activeTab.encoding}
              onChange={(event) =>
                onConvertEncoding(event.target.value as TextEncoding)
              }
            >
              <option value="utf-8">UTF-8</option>
              <option value="utf-8-bom">UTF-8 BOM</option>
              <option value="shift-jis">Shift-JIS</option>
              <option value="euc-jp">EUC-JP</option>
            </select>
          </label>
        </span>
      ) : null}
    </footer>
  );
}
