import type { LModeCopy } from "../../lib/locale";
import { LModeClasses } from "../../features/editor/lMode";
import { DiffIcon, FolderOpenIcon, SparklesIcon } from "./Icons";

type LModeActionRailProps = {
  copy: LModeCopy;
  onExitToWorkspace: () => void;
  onOpenAppleAssistWindow: () => void;
  onReviewChanges: () => void;
  reviewChangesAvailable: boolean;
};

// v0.12+ Apple Local Assist Writing Companion mock (slice 3).
// The L Mode action rail gains a third button — "Apple
// Assist" — that toggles the detached Writing Companion
// window without leaving L Mode. L Mode is the canonical
// "writing-time" surface, so the Apple Assist shortcut belongs
// here. The companion-slot mutual exclusion (closing the
// Agent window when opening Apple Assist, and vice versa) is
// enforced server-side by `toggle_apple_assist_window` /
// `open_agent_window`.
export function LModeActionRail({
  copy,
  onExitToWorkspace,
  onOpenAppleAssistWindow,
  onReviewChanges,
  reviewChangesAvailable,
}: LModeActionRailProps) {
  return (
    <div className={LModeClasses.actionRail} aria-label={copy.actionRailLabel}>
      <button
        className={LModeClasses.actionButton}
        onClick={onOpenAppleAssistWindow}
        title={copy.statusBarAppleAssistTitle}
        type="button"
      >
        <SparklesIcon />
        <span>{copy.statusBarAppleAssistLabel}</span>
      </button>
      {reviewChangesAvailable ? (
        <button
          className={LModeClasses.actionButton}
          onClick={onReviewChanges}
          title={copy.statusBarReviewChangesTitle}
          type="button"
        >
          <DiffIcon />
          <span>{copy.statusBarReviewChangesLabel}</span>
        </button>
      ) : null}
      <button
        className={LModeClasses.actionButton}
        onClick={onExitToWorkspace}
        title={copy.statusBarWorkspaceTitle}
        type="button"
      >
        <FolderOpenIcon />
        <span>{copy.statusBarWorkspaceLabel}</span>
      </button>
    </div>
  );
}
