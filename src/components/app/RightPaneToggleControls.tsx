import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BookIcon,
  DiffIcon,
  LModeIcon,
  OutlineIcon,
  PreviewIcon,
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
  active: boolean;
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

type ReviewPaneMenuProps = {
  copy: RightPaneToggleCopy;
  diffActive: boolean;
  diffAvailable: boolean;
  onReviewChanges: () => void;
  onToggleDiff: () => void;
  onToggleOutline: () => void;
  outlineActive: boolean;
  outlineAvailable: boolean;
  reviewChangesAvailable: boolean;
  reviewChangesLabel: string;
};

function ReviewPaneMenu({
  copy,
  diffActive,
  diffAvailable,
  onReviewChanges,
  onToggleDiff,
  onToggleOutline,
  outlineActive,
  outlineAvailable,
  reviewChangesAvailable,
  reviewChangesLabel,
}: ReviewPaneMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const closeAndRun = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="pane-review-menu" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-pressed={diffActive || outlineActive}
        className={`pane-toggle pane-review-menu-trigger${
          diffActive || outlineActive ? " active" : ""
        }`}
        onClick={() => setOpen((current) => !current)}
        title={copy.reviewMenuTitle}
        type="button"
      >
        <span className="pane-toggle-icon" aria-hidden="true">
          <DiffIcon />
        </span>
        <span className="pane-toggle-caption">{copy.reviewMenu}</span>
        <span className="pane-review-menu-chevron" aria-hidden="true">
          v
        </span>
      </button>
      {open ? (
        <div className="pane-review-menu-popover" role="menu">
          <button
            className="pane-review-menu-item"
            disabled={!reviewChangesAvailable}
            onClick={() => closeAndRun(onReviewChanges)}
            role="menuitem"
            type="button"
          >
            <span
              className={`pane-review-menu-dot${
                reviewChangesAvailable ? " active" : ""
              }`}
              aria-hidden="true"
            />
            <span>{reviewChangesLabel}</span>
          </button>
          <button
            aria-pressed={diffActive}
            className="pane-review-menu-item"
            disabled={!diffAvailable}
            onClick={() => closeAndRun(onToggleDiff)}
            role="menuitem"
            type="button"
          >
            <span className="pane-review-menu-icon" aria-hidden="true">
              <DiffIcon />
            </span>
            <span>{copy.diffTab}</span>
          </button>
          <button
            aria-pressed={outlineActive}
            className="pane-review-menu-item"
            disabled={!outlineAvailable}
            onClick={() => closeAndRun(onToggleOutline)}
            role="menuitem"
            type="button"
          >
            <span className="pane-review-menu-icon" aria-hidden="true">
              <OutlineIcon />
            </span>
            <span>{copy.outlineTab}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RightPaneToggleControls({
  copy,
  diffActive,
  diffAvailable,
  ebookActive,
  ebookAvailable,
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
        active={false}
        caption={lModeLabel}
        icon={<LModeIcon />}
        onClick={onToggleLMode}
        title={lModeTitle}
      />
      {ebookAvailable ? (
        <PaneToggle
          active={ebookActive}
          caption={copy.ebookTab}
          icon={<BookIcon />}
          onClick={onToggleEbook}
          title={copy.ebookTabTitle}
        />
      ) : null}
      <ReviewPaneMenu
        copy={copy}
        diffActive={diffActive}
        diffAvailable={diffAvailable}
        onReviewChanges={onReviewChanges}
        onToggleDiff={onToggleDiff}
        onToggleOutline={onToggleOutline}
        outlineActive={outlineActive}
        outlineAvailable={outlineAvailable}
        reviewChangesAvailable={reviewChangesAvailable}
        reviewChangesLabel={reviewChangesLabel}
      />
    </div>
  );
}
