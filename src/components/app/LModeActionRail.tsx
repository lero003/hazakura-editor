import type { LModeCopy } from "../../lib/locale";
import { LModeClasses } from "../../features/editor/lMode";
import { DiffIcon, FolderOpenIcon } from "./Icons";

type LModeActionRailProps = {
  copy: LModeCopy;
  onExitToWorkspace: () => void;
  onReviewChanges: () => void;
  reviewChangesAvailable: boolean;
};

export function LModeActionRail({
  copy,
  onExitToWorkspace,
  onReviewChanges,
  reviewChangesAvailable,
}: LModeActionRailProps) {
  return (
    <div className={LModeClasses.actionRail} aria-label={copy.actionRailLabel}>
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
