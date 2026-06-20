import { type ReactNode } from "react";
import {
  BookIcon,
  DiffIcon,
  LModeIcon,
  OutlineIcon,
  PreviewIcon,
  ReviewDeskIcon,
} from "./Icons";

export interface RightPaneToggleCopy {
  agentWindow: string;
  agentWindowTitle: string;
  appleAssistWindow: string;
  appleAssistWindowTitle: string;
  diffTab: string;
  diffTabTitle: string;
  ebookTab: string;
  ebookTabTitle: string;
  outlineTab: string;
  outlineTabTitle: string;
  previewTab: string;
  previewTabTitle: string;
  reviewMenu: string;
  reviewMenuTitle: string;
  sidePaneMode: string;
}

type PaneToggleProps = {
  active?: boolean;
  caption: string;
  disabled?: boolean;
  icon: ReactNode;
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
  copy,
  diffActive,
  diffAvailable,
  ebookActive,
  ebookAvailable,
  lModeActive,
  lModeLabel,
  lModeTitle,
  onReviewChanges,
  onToggleDiff,
  onToggleEbook,
  onToggleLMode,
  onToggleOutline,
  onTogglePreview,
  outlineActive,
  outlineAvailable,
  previewActive,
  reviewChangesAvailable,
  reviewChangesLabel,
}: {
  copy: RightPaneToggleCopy;
  diffActive: boolean;
  diffAvailable: boolean;
  ebookActive: boolean;
  ebookAvailable: boolean;
  lModeActive: boolean;
  lModeLabel: string;
  lModeTitle: string;
  onReviewChanges: () => void;
  onToggleDiff: () => void;
  onToggleEbook: () => void;
  onToggleLMode: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  outlineActive: boolean;
  outlineAvailable: boolean;
  previewActive: boolean;
  reviewChangesAvailable: boolean;
  reviewChangesLabel: string;
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
      <PaneToggle
        active={lModeActive}
        caption={lModeLabel}
        icon={<LModeIcon />}
        onClick={onToggleLMode}
        title={lModeTitle}
      />
      <PaneToggle
        active={ebookAvailable && ebookActive}
        caption={copy.ebookTab}
        disabled={!ebookAvailable}
        icon={<BookIcon />}
        onClick={onToggleEbook}
        title={copy.ebookTabTitle}
      />
      <PaneToggle
        caption={copy.reviewMenu}
        disabled={!reviewChangesAvailable}
        icon={<ReviewDeskIcon />}
        onClick={onReviewChanges}
        title={reviewChangesLabel || copy.reviewMenuTitle}
      />
      <PaneToggle
        active={diffActive}
        caption={copy.diffTab}
        disabled={!diffAvailable}
        icon={<DiffIcon />}
        onClick={onToggleDiff}
        title={copy.diffTabTitle}
      />
      <PaneToggle
        active={outlineAvailable && outlineActive}
        caption={copy.outlineTab}
        disabled={!outlineAvailable}
        icon={<OutlineIcon />}
        onClick={onToggleOutline}
        title={copy.outlineTabTitle}
      />
    </div>
  );
}
