import type {
  EditableLineEnding,
  EditorTab,
  TextEncoding,
} from "../../types";

type StatusBarProps = {
  activeTab: EditorTab | null;
  agentLabel: string | null;
  detail: string;
  dirtyLabel: string;
  encodingAriaLabel: string;
  encodingLabel: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeEnabled: boolean;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  statusText: string;
};

export function StatusBar({
  activeTab,
  agentLabel,
  detail,
  dirtyLabel,
  encodingAriaLabel,
  encodingLabel,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeEnabled,
  onConvertEncoding,
  onConvertLineEnding,
  saveAffirmation,
  saveAffirmationKey,
  statusText,
}: StatusBarProps) {
  return (
    <footer className="status-bar lmode-surface">
      <span className="status-bar-segment status-bar-status" role="status" aria-live="polite">
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
        {dirtyLabel ? (
          <span
            className="status-bar-unsaved-pill"
            aria-label={dirtyLabel}
            title={dirtyLabel}
          >
            {dirtyLabel}
          </span>
        ) : null}
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
