import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import type {
  AssistSurfacePreference,
  MenuLanguage,
} from "../../types";

export type LModeWorkspaceSidebarProps = ComponentProps<typeof WorkspaceSidebar>;

type LModeActionRailProps = {
  activeDirty: boolean;
  activeDocumentPath: string | null;
  assistSurfaceActive: AssistSurfacePreference;
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

// v0.12+ Hazakura Local Assist Writing Companion mock (slice 3).
// The L Mode action rail gains a third button — "Apple
// Assist" — that toggles the detached Writing Companion
// window without leaving L Mode. L Mode is the canonical
// "writing-time" surface, so the Hazakura Local Assist shortcut belongs
// here. The companion-slot mutual exclusion (closing the
// Agent window when opening Hazakura Local Assist, and vice versa) is
// enforced server-side by `toggle_apple_assist_window` /
// `open_agent_window`.
//
// v0.15 polish: the Hazakura Local Assist button is hidden when the
// user has set the Assist Surface preference to anything
// other than `apple-local` (e.g. `external-cli` or `none`).
// Without this guard, a user who turned the Apple Local
// Assist companion off in Preferences would still see a
// working Hazakura Local Assist button inside L Mode — and clicking
// it would silently toggle nothing. The L Mode action rail
// now mirrors the `DocumentMetaBar` companion-section rule
// (`assistSurfaceActive === "apple-local"`) so the rail
// stays honest about what the user actually has available.
export function LModeActionRail({
  activeDirty,
  activeDocumentPath,
  assistSurfaceActive,
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
  const showAppleAssistButton = assistSurfaceActive === "apple-local";
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [changeReview, setChangeReview] =
    useState<ChangeReviewSnapshot | null>(null);
  const activeDocumentPathRef = useRef(activeDocumentPath);
  const reviewRequestSeqRef = useRef(0);
  activeDocumentPathRef.current = activeDocumentPath;

  // Refs into the workspace-toggle and review-changes buttons
  // so we can restore focus after a drawer / sheet closes.
  // Without this, Escape or the close button drops focus
  // back to <body>, which makes the next Tab press jump to the
  // first non-action control (usually a settings cog) instead
  // of the next action-rail button. Returning focus to the
  // originating button keeps keyboard users inside the rail.
  //
  // Declared before the Escape effect below because the
  // Escape handler closes through these helpers to keep
  // focus-restoration behavior identical across every close
  // path.
  const workspaceToggleRef = useRef<HTMLButtonElement | null>(null);
  const reviewChangesButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
    workspaceToggleRef.current?.focus();
  }, []);

  const closeChangeReview = useCallback(() => {
    setChangeReview(null);
    reviewChangesButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!workspaceOpen && !changeReview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.isComposing) return;
      // Close the surface that is currently open. We route
      // through the same helpers as the explicit close
      // buttons so focus restoration stays consistent across
      // every close path: a `setWorkspaceOpen(false)` /
      // `setChangeReview(null)` direct call would skip the
      // focus-restoration side effect.
      //
      // Priority: change review sheet sits on top of the
      // workspace drawer (it is a more focused writing-time
      // surface), so Escape closes it first.
      if (changeReview) {
        closeChangeReview();
        return;
      }
      if (workspaceOpen) {
        closeWorkspace();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [changeReview, closeChangeReview, closeWorkspace, workspaceOpen]);

  useEffect(() => {
    setChangeReview(null);
  }, [activeDocumentPath]);

  useEffect(() => {
    if (!activeDirty) {
      setChangeReview(null);
    }
  }, [activeDirty]);

  const handleReviewChanges = useCallback(async () => {
    const requestSeq = reviewRequestSeqRef.current + 1;
    reviewRequestSeqRef.current = requestSeq;
    const snapshot = await onReviewChanges();
    if (
      snapshot &&
      requestSeq === reviewRequestSeqRef.current &&
      snapshot.compareCase.documentPath === activeDocumentPathRef.current
    ) {
      setChangeReview(snapshot);
    }
  }, [onReviewChanges]);

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
        ref={workspaceToggleRef}
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
        {showAppleAssistButton ? (
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
        ) : null}
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
            ref={reviewChangesButtonRef}
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
