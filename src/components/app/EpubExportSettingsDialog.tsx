import { useState, type RefObject } from "react";
import type { EpubExportSettings } from "../../features/document/epubExport";
import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { ExportPreflightSummary } from "./ExportPreflightSummary";

type EpubExportSettingsDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  documentName: string;
  initialSettings: EpubExportSettings;
  hasUnsavedChanges: boolean;
  menuLanguage: MenuLanguage;
  onCancel: () => void;
  onConfirm: (settings: EpubExportSettings) => void;
};

export function EpubExportSettingsDialog({
  cancelButtonRef,
  dialogRef,
  documentName,
  initialSettings,
  hasUnsavedChanges,
  menuLanguage,
  onCancel,
  onConfirm,
}: EpubExportSettingsDialogProps) {
  const copy = getEpubExportSettingsCopy(menuLanguage);
  const [title, setTitle] = useState(initialSettings.title);
  const [author, setAuthor] = useState(initialSettings.author);
  const [language, setLanguage] = useState(initialSettings.language);
  const titleValid = title.trim().length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="epub-export-settings-description"
        aria-labelledby="epub-export-settings-title"
        aria-modal="true"
        className="close-dialog epub-export-settings-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="epub-export-settings-title">{copy.title}</h2>
        <p id="epub-export-settings-description" title={documentName}>
          {documentName}
        </p>
        <p className="epub-export-settings-note">
          {copy.scopeNote}
        </p>
        <ExportPreflightSummary
          format="EPUB"
          hasUnsavedChanges={hasUnsavedChanges}
          menuLanguage={menuLanguage}
        />
        <form
          className="epub-export-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!titleValid) {
              return;
            }
            onConfirm({
              author,
              language,
              title,
            });
          }}
        >
          <label className="field-control">
            <span>{copy.titleField}</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </label>
          <label className="field-control">
            <span>{copy.authorField}</span>
            <input
              value={author}
              onChange={(event) => setAuthor(event.currentTarget.value)}
            />
          </label>
          <label className="field-control">
            <span>{copy.languageField}</span>
            <input
              value={language}
              onChange={(event) => setLanguage(event.currentTarget.value)}
            />
          </label>
          <div className="dialog-actions">
            <button type="submit" disabled={!titleValid}>
              {copy.export}
            </button>
            <button ref={cancelButtonRef} type="button" onClick={onCancel}>
              {copy.cancel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEpubExportSettingsCopy(menuLanguage: MenuLanguage) {
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      authorField: "著者名",
      cancel: "キャンセル",
      export: "書き出す",
      languageField: "言語",
      scopeNote:
        "電子書籍モードは読むためのプレビューです。書き出されるEPUBは単一Markdown文書を対象とし、Hazakuraは完全なEPUB制作ツールではありません。",
      title: "EPUB書き出し",
      titleField: "書名",
    };
  }

  return {
    authorField: "Author",
    cancel: "Cancel",
    export: "Export",
    languageField: "Language",
    scopeNote:
      "E-book Mode is a reading preview. The exported EPUB targets a single Markdown document, and Hazakura is not a full EPUB production tool.",
    title: "EPUB Export",
    titleField: "Title",
  };
}
