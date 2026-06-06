import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LModeCopy } from "../../lib/locale";
import { LModeClasses } from "../../features/editor/lMode";
import {
  DiffIcon,
  FolderOpenIcon,
  SparklesIcon,
  TypewriterIcon,
} from "./Icons";
import { WorkspaceSidebar } from "../workspace/WorkspaceSidebar";
import { DiffBody } from "../diff/DiffBody";
import type { ChangeReviewSnapshot } from "../../hooks/diff/useCompareExecution";
import type { MenuLanguage } from "../../types";

export type LModeWorkspaceSidebarProps = ComponentProps<typeof WorkspaceSidebar>;

type LModeActionRailProps = {
  activeDirty: boolean;
  activeDocumentPath: string | null;
  copy: LModeCopy;
  dirtyLabel: string;
  menuLanguage: MenuLanguage;
  onOpenAppleAssistWindow: () => void;
  onReviewChanges: () => Promise<ChangeReviewSnapshot | null>;
  onToggleTypewriterMode: () => void;
  reviewChangesAvailable: boolean;
  typewriterModeEnabled: boolean;
  workspaceSidebarProps: LModeWorkspaceSidebarProps;
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
  activeDirty,
  activeDocumentPath,
  copy,
  dirtyLabel,
  menuLanguage,
  onOpenAppleAssistWindow,
  onReviewChanges,
  onToggleTypewriterMode,
  reviewChangesAvailable,
  typewriterModeEnabled,
  workspaceSidebarProps,
}: LModeActionRailProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [changeReview, setChangeReview] =
    useState<ChangeReviewSnapshot | null>(null);

  useEffect(() => {
    if (!workspaceOpen && !changeReview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkspaceOpen(false);
        setChangeReview(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [changeReview, workspaceOpen]);

  useEffect(() => {
    setChangeReview(null);
  }, [activeDocumentPath]);

  useEffect(() => {
    if (!activeDirty) {
      setChangeReview(null);
    }
  }, [activeDirty]);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
  }, []);

  const closeChangeReview = useCallback(() => {
    setChangeReview(null);
  }, []);

  const handleReviewChanges = useCallback(async () => {
    const snapshot = await onReviewChanges();
    if (snapshot && snapshot.compareCase.documentPath === activeDocumentPath) {
      setChangeReview(snapshot);
    }
  }, [activeDocumentPath, onReviewChanges]);

  const sidebarProps = useMemo<LModeWorkspaceSidebarProps>(
    () => ({
      ...workspaceSidebarProps,
      onOpenFile: (path) => {
        const result = workspaceSidebarProps.onOpenFile(path);
        setWorkspaceOpen(false);
        return result;
      },
    }),
    [workspaceSidebarProps],
  );

  const workspaceToggleLabel =
    activeDirty && dirtyLabel
      ? `${copy.workspaceToggleLabel} (${dirtyLabel})`
      : copy.workspaceToggleLabel;
  const changeReviewCountsLabel = changeReview
    ? `+${changeReview.compareView.additions} / -${changeReview.compareView.removals}`
    : "";

  return (
    <>
      <button
        aria-expanded={workspaceOpen}
        aria-label={workspaceToggleLabel}
        className={`${LModeClasses.workspaceToggle} lmode-surface`}
        data-open={workspaceOpen ? "true" : "false"}
        onClick={() => setWorkspaceOpen((open) => !open)}
        title={copy.workspaceToggleTitle}
        type="button"
      >
        <FolderOpenIcon />
        {activeDirty ? (
          <span
            aria-hidden="true"
            className={LModeClasses.workspaceUnsavedDot}
            title={dirtyLabel || copy.unsavedIndicatorLabel}
          />
        ) : null}
      </button>
      {workspaceOpen ? (
        <div
          aria-label={copy.workspaceOverlayLabel}
          className={LModeClasses.workspaceOverlay}
          role="dialog"
        >
          <button
            aria-label={copy.workspaceOverlayCloseLabel}
            className={LModeClasses.workspaceBackdrop}
            onClick={closeWorkspace}
            type="button"
          />
          <div className={LModeClasses.workspaceDrawer}>
            <WorkspaceSidebar {...sidebarProps} />
          </div>
        </div>
      ) : null}
      <div
        className={`${LModeClasses.actionRail} lmode-surface`}
        aria-label={copy.actionRailLabel}
      >
        <button
          aria-label={copy.statusBarAppleAssistLabel}
          className={LModeClasses.actionButton}
          onClick={onOpenAppleAssistWindow}
          title={copy.actionRailAppleAssistTooltip}
          type="button"
        >
          <SparklesIcon />
          <span aria-hidden="true" className={LModeClasses.actionButtonLabel}>
            {copy.actionRailAppleAssistShortLabel}
          </span>
        </button>
        <button
          aria-label={copy.typewriterPreferenceLabel}
          aria-pressed={typewriterModeEnabled}
          className={LModeClasses.actionButton}
          onClick={onToggleTypewriterMode}
          title={copy.actionRailTypewriterTooltip}
          type="button"
        >
          <TypewriterIcon />
          <span aria-hidden="true" className={LModeClasses.actionButtonLabel}>
            {copy.actionRailTypewriterShortLabel}
          </span>
        </button>
        {reviewChangesAvailable ? (
          <button
            aria-label={copy.statusBarReviewChangesLabel}
            className={LModeClasses.actionButton}
            onClick={() => void handleReviewChanges()}
            title={copy.actionRailReviewChangesTooltip}
            type="button"
          >
            <DiffIcon />
            <span aria-hidden="true" className={LModeClasses.actionButtonLabel}>
              {copy.actionRailReviewChangesShortLabel}
            </span>
          </button>
        ) : null}
      </div>
      {changeReview ? (
        <div
          aria-label={copy.changeReviewSheetLabel}
          className={LModeClasses.changeReviewSheet}
          role="dialog"
        >
          <div className={LModeClasses.changeReviewHeader}>
            <span aria-hidden="true" className={LModeClasses.changeReviewIcon}>
              <DiffIcon />
            </span>
            <span className={LModeClasses.changeReviewTitleGroup}>
              <span className={LModeClasses.changeReviewTitle}>
                {copy.changeReviewSheetTitle}
              </span>
              <span className={LModeClasses.changeReviewMeta}>
                {changeReview.compareCase.documentLabel}
              </span>
            </span>
            <span
              aria-label={changeReviewCountsLabel}
              className={LModeClasses.changeReviewCounts}
            >
              <span>+{changeReview.compareView.additions}</span>
              <span>-{changeReview.compareView.removals}</span>
            </span>
            <button
              aria-label={copy.changeReviewSheetCloseLabel}
              className={LModeClasses.changeReviewCloseButton}
              onClick={closeChangeReview}
              title={copy.changeReviewSheetCloseTitle}
              type="button"
            >
              ×
            </button>
          </div>
          <div className={LModeClasses.changeReviewDiff} role="table">
            <div className="diff-split-row diff-row-header" role="row">
              <span className="diff-line-number" role="columnheader" />
              <span className="diff-text-column" role="columnheader">
                {changeReview.compareCase.leftColumnLabel}
              </span>
              <span className="diff-line-number" role="columnheader" />
              <span className="diff-text-column" role="columnheader">
                {changeReview.compareCase.rightColumnLabel}
              </span>
            </div>
            <DiffBody
              compareCase={changeReview.compareCase}
              menuLanguage={menuLanguage}
              view={changeReview.compareView}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
