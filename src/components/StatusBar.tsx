type StatusBarProps = {
  agentLabel: string | null;
  detail: string;
  statusText: string;
};

export function StatusBar({ agentLabel, detail, statusText }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>{statusText}</span>
      {agentLabel ? (
        <span className="status-agent-indicator" title="Agent mode active">
          <span className="status-agent-dot" />
          {agentLabel}
        </span>
      ) : null}
      <span>{detail}</span>
    </footer>
  );
}
