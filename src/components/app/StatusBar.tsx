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
  const showFormatControls = Boolean(activeTab && !lModeEnabled);
  const visibleDetail = showFormatControls && activeTab
    ? compactVisibleDetail(removeDuplicateFormatValues(detail, activeTab))
    : detail;

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
      {showFormatControls && activeTab ? (
        <span className="status-bar-format-group">
          <span className="status-bar-segment status-bar-detail" title={detail}>
            {visibleDetail}
          </span>
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
      ) : (
        <span className="status-bar-segment status-bar-detail" title={detail}>
          {visibleDetail}
        </span>
      )}
    </footer>
  );
}

function removeDuplicateFormatValues(detail: string, activeTab: EditorTab): string {
  const duplicateValues = new Set([
    formatVisibleLineEnding(activeTab.line_ending),
    formatVisibleEncoding(activeTab.encoding),
  ]);
  const visibleParts = detail
    .split(" · ")
    .filter((part) => !duplicateValues.has(part));

  return visibleParts.length > 0 ? visibleParts.join(" · ") : detail;
}

function compactVisibleDetail(detail: string): string {
  const visibleParts = detail.split(" · ").slice(0, 3);

  return visibleParts.length > 0 ? visibleParts.join(" · ") : detail;
}

function formatVisibleLineEnding(lineEnding: EditableLineEnding): string {
  return lineEnding === "crlf" ? "CRLF" : "LF";
}

function formatVisibleEncoding(encoding: TextEncoding): string {
  switch (encoding) {
    case "utf-8":
      return "UTF-8";
    case "utf-8-bom":
      return "UTF-8 BOM";
    case "shift-jis":
      return "Shift-JIS";
    case "euc-jp":
      return "EUC-JP";
  }
}
