import { helpDocsByMode, isHelpDocumentDialogMode } from "./helpDocs";
import type { ReactNode, RefObject } from "react";
import type { PreferencesDialogMode } from "../../types";

type PreferencesDialogProps = {
  children: ReactNode;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  closeLabel: string;
  dialogRef: RefObject<HTMLElement | null>;
  mode: PreferencesDialogMode;
  onClose: () => void;
  onChangeMode?: (mode: PreferencesDialogMode) => void;
  title: string;
};

export function PreferencesDialog({
  children,
  closeButtonRef,
  closeLabel,
  dialogRef,
  mode,
  onClose,
  onChangeMode,
  title,
}: PreferencesDialogProps) {
  const isHelpMode = mode !== "settings" && mode !== "agent";
  const modeClass =
    mode === "agent"
      ? "agent-workbench-dialog"
      : isHelpMode
        ? "privacy-dialog"
        : "settings-dialog";

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="preferences-title"
        aria-modal="true"
        className={`preferences-dialog ${modeClass}`}
        ref={dialogRef}
        role="dialog"
      >
        <div className="preferences-header">
          <h2
            className={isHelpMode ? "sr-only" : undefined}
            id="preferences-title"
          >
            {title}
          </h2>
          <button
            aria-label={closeLabel}
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {onChangeMode && mode !== "agent" ? (
          <label className="preferences-help-navigation">
            <span>Settings / Help</span>
            <select aria-label="Settings / Help" value={mode} onChange={(event) => {
              const next = event.target.value;
              if (next === "settings" || isHelpDocumentDialogMode(next)) onChangeMode(next);
            }}>
              <option value="settings">Settings</option>
              {Object.entries(helpDocsByMode).map(([key, doc]) =>
                <option key={key} value={key}>{doc.title}</option>)}
            </select>
          </label>
        ) : null}
        {children}
      </section>
    </div>
  );
}
