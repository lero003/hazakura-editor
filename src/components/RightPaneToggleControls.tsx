import {
  AgentIcon,
  DiffIcon,
  OutlineIcon,
  PreviewIcon,
} from "./Icons";

export interface RightPaneToggleCopy {
  agentTab: string;
  agentTabTitle: string;
  diffTab: string;
  diffTabTitle: string;
  outlineTab: string;
  outlineTabTitle: string;
  previewTab: string;
  previewTabTitle: string;
  sidePaneMode: string;
}

type PaneToggleProps = {
  active: boolean;
  caption: string;
  disabled?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
};

function PaneToggle({
  active,
  caption,
  disabled,
  icon,
  onClick,
  title,
}: PaneToggleProps) {
  return (
    <button
      aria-pressed={active}
      className={`pane-toggle${active ? " active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <span className="pane-toggle-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="pane-toggle-caption">{caption}</span>
    </button>
  );
}

export function RightPaneToggleControls({
  agentActive,
  agentAvailable,
  copy,
  diffActive,
  diffAvailable,
  onToggleAgent,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  outlineActive,
  outlineAvailable,
  previewActive,
}: {
  agentActive: boolean;
  agentAvailable: boolean;
  copy: RightPaneToggleCopy;
  diffActive: boolean;
  diffAvailable: boolean;
  onToggleAgent: () => void;
  onToggleDiff: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  outlineActive: boolean;
  outlineAvailable: boolean;
  previewActive: boolean;
}) {
  return (
    <div className="pane-toggles" aria-label={copy.sidePaneMode}>
      <PaneToggle
        active={previewActive}
        caption={copy.previewTab}
        icon={<PreviewIcon />}
        onClick={onTogglePreview}
        title={copy.previewTabTitle}
      />
      {diffAvailable ? (
        <PaneToggle
          active={diffActive}
          caption={copy.diffTab}
          icon={<DiffIcon />}
          onClick={onToggleDiff}
          title={copy.diffTabTitle}
        />
      ) : null}
      <PaneToggle
        active={outlineActive}
        caption={copy.outlineTab}
        disabled={!outlineAvailable}
        icon={<OutlineIcon />}
        onClick={onToggleOutline}
        title={copy.outlineTabTitle}
      />
      {agentAvailable ? (
        <PaneToggle
          active={agentActive}
          caption={copy.agentTab}
          icon={<AgentIcon />}
          onClick={onToggleAgent}
          title={copy.agentTabTitle}
        />
      ) : null}
    </div>
  );
}
