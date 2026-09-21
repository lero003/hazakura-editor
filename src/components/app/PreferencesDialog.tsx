import { helpDocsByMode, isHelpDocumentDialogMode } from "./helpDocs";
import type { ReactNode, RefObject } from "react";
import { getCommandPaletteCopy } from "../../lib/locale/commandPalette";
import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import type { PreferencesDialogMode } from "../../types";

type PreferencesDialogProps = {
  children: ReactNode;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  closeLabel: string;
  dialogRef: RefObject<HTMLElement | null>;
  mode: PreferencesDialogMode;
  /**
   * オンデバイスモデルページの見出し。Settings 本文の入口と同じ値を渡し、
   * ナビの項目名をページ側と二重定義しない。
   */
  modelsLabel?: string;
  menuLanguage?: MenuLanguage;
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
  modelsLabel,
  menuLanguage = "en",
  onClose,
  onChangeMode,
  title,
}: PreferencesDialogProps) {
  const navigationCopy = getCommandPaletteCopy(menuLanguage);
  const helpCommands = {
    privacy: "help.localDataDisclosure",
    diagnostics: "help.supportDiagnostics",
    "privacy-policy": "help.privacyPolicy",
    "open-source-acknowledgements": "help.openSourceAcknowledgements",
    "books-and-knowledge-folders": "help.booksAndKnowledgeFolders",
    about: "help.about",
  } as const;
  const navigationLabel = isJapaneseMenuLanguage(menuLanguage) ? "設定 / ヘルプ" : "Settings / Help";
  const hasNavigation = onChangeMode && mode !== "agent";
  // "settings" / "agent" / "models" は設定系、それ以外はヘルプ文書のページ。
  const isHelpMode = isHelpDocumentDialogMode(mode);
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
            className={isHelpMode || hasNavigation ? "sr-only" : undefined}
            id="preferences-title"
          >
            {title}
          </h2>
          {hasNavigation ? (
            <label className="preferences-help-navigation">
              <span className="sr-only">{navigationLabel}</span>
              <select aria-label={navigationLabel} value={mode} onChange={(event) => {
                const next = event.target.value;
                if (next === "settings" || next === "models" || isHelpDocumentDialogMode(next)) {
                  onChangeMode(next);
                }
              }}>
                <option value="settings">{navigationCopy.commands["settings.open"].label.replace(/…$/, "")}</option>
                {modelsLabel ? <option value="models">{modelsLabel}</option> : null}
                {Object.keys(helpDocsByMode).filter(isHelpDocumentDialogMode).map((key) =>
                  <option key={key} value={key}>{navigationCopy.commands[helpCommands[key]].label.replace(/…$/, "")}</option>)}
              </select>
            </label>
          ) : null}
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
        {children}
      </section>
    </div>
  );
}
