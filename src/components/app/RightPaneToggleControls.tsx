import { useMemo, type ReactNode } from "react";
import { resolvePaneToggleTitles } from "../../features/workspace/paneToggleTitles";
import {
  BookIcon,
  DiffIcon,
  LModeIcon,
  OutlineIcon,
  PreviewIcon,
  ReferenceIcon,
  ReviewDeskIcon,
} from "./Icons";

export interface RightPaneToggleCopy {
  agentWindow: string;
  agentWindowTitle: string;
  appleAssistWindow: string;
  appleAssistWindowTitle: string;
  /** Title suffix when Assist is disabled for this session. */
  appleAssistUnavailableSession: string;
  /** Title suffix when Assist is unsupported on this Mac. */
  appleAssistUnsupportedMac: string;
  diffTab: string;
  diffTabTitle: string;
  diffTabTitleHide: string;
  ebookTab: string;
  ebookTabTitle: string;
  ebookTabTitleHide: string;
  outlineTab: string;
  outlineTabTitle: string;
  outlineTabTitleHide: string;
  previewTab: string;
  previewTabTitle: string;
  previewTabTitleHide: string;
  referenceTab: string;
  referenceTabTitle: string;
  referenceTabTitleHide: string;
  referenceTabTitleRetained: string;
  reviewMenu: string;
  reviewMenuTitle: string;
  sidePaneMode: string;
}

type PaneToggleProps = {
  active?: boolean;
  /** Accessible name when it should differ from the visible caption (e.g. retained). */
  ariaLabel?: string;
  caption: string;
  className?: string;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
  /** Loaded-but-hidden affordance (Reference session retained). */
  retained?: boolean;
  title: string;
};

function PaneToggle({
  active,
  ariaLabel,
  caption,
  className,
  disabled,
  icon,
  onClick,
  retained = false,
  title,
}: PaneToggleProps) {
  const classes = [
    "pane-toggle",
    active ? "active" : "",
    retained ? "pane-toggle-retained" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={classes}
      data-retained={retained ? "true" : undefined}
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
  onReviewChanges,
  onToggleDiff,
  onToggleEbook,
  onToggleOutline,
  onTogglePreview,
  outlineActive,
  outlineAvailable,
  previewActive,
  referenceActive,
  referenceLoaded = false,
  reviewChangesAvailable,
  reviewChangesLabel,
  onToggleReference,
}: {
  copy: RightPaneToggleCopy;
  diffActive: boolean;
  diffAvailable: boolean;
  ebookActive: boolean;
  ebookAvailable: boolean;
  onReviewChanges: () => void;
  onToggleDiff: () => void;
  onToggleEbook: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  outlineActive: boolean;
  outlineAvailable: boolean;
  previewActive: boolean;
  referenceActive: boolean;
  /** Loaded reference session exists even when the column is hidden. */
  referenceLoaded?: boolean;
  reviewChangesAvailable: boolean;
  reviewChangesLabel: string;
  onToggleReference: () => void;
}) {
  const titles = useMemo(
    () =>
      resolvePaneToggleTitles(copy, {
        previewActive,
        referenceActive,
        referenceLoaded,
        ebookActive: ebookAvailable && ebookActive,
        outlineActive: outlineAvailable && outlineActive,
        diffActive,
      }),
    [
      copy,
      diffActive,
      ebookActive,
      ebookAvailable,
      outlineActive,
      outlineAvailable,
      previewActive,
      referenceActive,
      referenceLoaded,
    ],
  );

  return (
    <div className="pane-control-cluster" aria-label={copy.sidePaneMode}>
      {reviewChangesAvailable ? (
        <PaneToggle
          caption={copy.reviewMenu}
          className="pane-review-action"
          icon={<ReviewDeskIcon />}
          onClick={onReviewChanges}
          title={reviewChangesLabel || copy.reviewMenuTitle}
        />
      ) : null}
      <div className="pane-toggles">
        <PaneToggle
          active={previewActive}
          caption={copy.previewTab}
          icon={<PreviewIcon />}
          onClick={onTogglePreview}
          title={titles.preview}
        />
        <PaneToggle
          active={referenceActive}
          ariaLabel={
            referenceLoaded && !referenceActive
              ? titles.reference
              : undefined
          }
          caption={copy.referenceTab}
          icon={<ReferenceIcon />}
          onClick={onToggleReference}
          retained={referenceLoaded && !referenceActive}
          title={titles.reference}
        />
        <PaneToggle
          active={ebookAvailable && ebookActive}
          caption={copy.ebookTab}
          disabled={!ebookAvailable}
          icon={<BookIcon />}
          onClick={onToggleEbook}
          title={titles.ebook}
        />
        <PaneToggle
          active={outlineAvailable && outlineActive}
          caption={copy.outlineTab}
          disabled={!outlineAvailable}
          icon={<OutlineIcon />}
          onClick={onToggleOutline}
          title={titles.outline}
        />
        <PaneToggle
          active={diffActive}
          caption={copy.diffTab}
          disabled={!diffAvailable}
          icon={<DiffIcon />}
          onClick={onToggleDiff}
          title={titles.diff}
        />
      </div>
    </div>
  );
}

export function EditingModeControl({
  active,
  label,
  onToggle,
  title,
}: {
  active: boolean;
  label: string;
  onToggle: () => void;
  title: string;
}) {
  return (
    <div className="editing-mode-control" aria-label={title}>
      <PaneToggle
        active={active}
        caption={label}
        icon={<LModeIcon />}
        onClick={onToggle}
        title={title}
      />
    </div>
  );
}
