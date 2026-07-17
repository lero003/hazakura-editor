import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

/**
 * Shared right-pane chrome. Intentionally thin so Preview / e-book /
 * Outline / Diff / Reference can restyle or swap it without a shell rewrite.
 */
export type RightPaneHeaderProps = {
  /** Machine id for CSS hooks and tests. */
  mode: string;
  title: string;
  purpose?: string | null;
  closeLabel: string;
  onClose?: () => void;
  /** Trailing actions before the close control (replace, show diff, …). */
  actions?: ReactNode;
};

export function RightPaneHeader({
  mode,
  title,
  purpose = null,
  closeLabel,
  onClose,
  actions = null,
}: RightPaneHeaderProps) {
  const handleCloseKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <header
      className="right-pane-header"
      data-right-pane-mode={mode}
      data-testid="right-pane-header"
    >
      <div className="right-pane-header-text">
        <h2 className="right-pane-header-title">{title}</h2>
        {purpose ? (
          <p className="right-pane-header-purpose" role="note">
            {purpose}
          </p>
        ) : null}
      </div>
      <div className="right-pane-header-actions">
        {actions}
        {onClose ? (
          <button
            type="button"
            className="right-pane-header-close"
            onClick={onClose}
            onKeyDown={handleCloseKeyDown}
            aria-label={closeLabel}
            title={closeLabel}
          >
            ×
          </button>
        ) : null}
      </div>
    </header>
  );
}
