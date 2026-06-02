import type { EditableLineEnding, EditorTab } from "../../types";

type StatusBarProps = {
  activeTab: EditorTab | null;
  agentLabel: string | null;
  detail: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  statusText: string;
};

export function StatusBar({
  activeTab,
  agentLabel,
  detail,
  lineEndingAriaLabel,
  lineEndingLabel,
  onConvertLineEnding,
  saveAffirmation,
  saveAffirmationKey,
  statusText,
}: StatusBarProps) {
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
      {activeTab ? (
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
      ) : null}
      <span className="status-bar-segment status-bar-spacer" aria-hidden="true" />
      <span className="status-bar-segment status-bar-detail">{detail}</span>
    </footer>
  );
}
