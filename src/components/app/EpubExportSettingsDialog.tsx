import { useState, type RefObject } from "react";
import { pickEpubCoverImage } from "../../lib/tauri/dialog";
import type { EpubExportSettings } from "../../features/document/epubExport";
import type { MenuLanguage } from "../../types";
import { ExportPreflightSummary } from "./ExportPreflightSummary";
import type { DocumentExportScope } from "../../features/document/exportScope";
import { ExportScopeSelector } from "./ExportScopeSelector";
import type { ExportPreflightResult } from "../../features/document/exportPreflight";

type EpubExportSettingsDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  bookAvailable?: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  documentName: string;
  initialSettings: EpubExportSettings;
  hasUnsavedChanges: boolean;
  initialScope?: DocumentExportScope;
  menuLanguage: MenuLanguage;
  preflightByScope?: Record<DocumentExportScope, ExportPreflightResult>;
  onCancel: () => void;
  onConfirm: (settings: EpubExportSettings, scope: DocumentExportScope) => void;
};

export function EpubExportSettingsDialog({
  bookAvailable = false,
  cancelButtonRef,
  dialogRef,
  documentName,
  initialSettings,
  hasUnsavedChanges,
  initialScope = "document",
  menuLanguage,
  preflightByScope,
  onCancel,
  onConfirm,
}: EpubExportSettingsDialogProps) {
  const copy = getEpubExportSettingsCopy(menuLanguage);
  const [title, setTitle] = useState(initialSettings.title);
  const [author, setAuthor] = useState(initialSettings.author);
  const [language, setLanguage] = useState(initialSettings.language);
  const [coverImagePath, setCoverImagePath] = useState(
    initialSettings.coverImagePath ?? null,
  );
  const [scope, setScope] = useState<DocumentExportScope>(initialScope);
  const titleValid = title.trim().length > 0;
  const hasBlockingIssue = preflightByScope?.[scope].issues.some(
    (issue) => issue.severity === "error",
  ) ?? false;

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
        {bookAvailable ? (
          <ExportScopeSelector
            menuLanguage={menuLanguage}
            onChange={setScope}
            value={scope}
          />
        ) : null}
        <ExportPreflightSummary
          format="EPUB"
          hasUnsavedChanges={hasUnsavedChanges}
          menuLanguage={menuLanguage}
          metadataMissing={[
            ...(title.trim() ? [] : [copy.titleField]),
            ...(author.trim() ? [] : [copy.authorField]),
            ...(language.trim() ? [] : [copy.languageField]),
          ]}
          preflight={preflightByScope?.[scope]}
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
              ...(coverImagePath ? { coverImagePath } : {}),
              language,
              title,
            }, scope);
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
          <div className="epub-cover-field">
            <span>{copy.coverImageField}</span>
            <div className="epub-cover-actions">
              <button
                type="button"
                onClick={() => {
                  void pickEpubCoverImage().then((path) => {
                    if (path) setCoverImagePath(path);
                  });
                }}
              >
                {copy.chooseCoverImage}
              </button>
              {coverImagePath ? (
                <button type="button" onClick={() => setCoverImagePath(null)}>
                  {copy.clearCoverImage}
                </button>
              ) : null}
            </div>
            <span className="epub-cover-selection">
              {coverImagePath
                ? coverImagePath.split("/").filter(Boolean).pop()
                : copy.noCoverImage}
            </span>
          </div>
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
            <button type="submit" disabled={!titleValid || hasBlockingIssue}>
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
  if (menuLanguage === "kana") {
    return {
      authorField: "かいたひと",
      cancel: "やめる",
      chooseCoverImage: "ひょうしがぞうを えらぶ",
      clearCoverImage: "ひょうしがぞうを はずす",
      coverImageField: "ひょうしがぞう（なくてもよい）",
      export: "かきだす",
      languageField: "ことば",
      scopeNote:
        "でんししょせきもーどは よむための ぷれびゅーです。いまのファイルか 本全体を えらんで かきだします。",
      title: "EPUBかきだし",
      titleField: "しょめい",
      noCoverImage: "えらんでいません",
    };
  }

  if (menuLanguage === "ja") {
    return {
      authorField: "著者名",
      cancel: "キャンセル",
      chooseCoverImage: "表紙画像を選ぶ",
      clearCoverImage: "表紙画像を外す",
      coverImageField: "表紙画像（任意）",
      export: "書き出す",
      languageField: "言語",
      scopeNote:
        "電子書籍モードは読むためのプレビューです。現在のファイルまたは本全体を選んで書き出します。",
      title: "EPUB書き出し",
      titleField: "書名",
      noCoverImage: "選択されていません",
    };
  }

  return {
    authorField: "Author",
    cancel: "Cancel",
    chooseCoverImage: "Choose cover image",
    clearCoverImage: "Remove cover image",
    coverImageField: "Cover image (optional)",
    export: "Export",
    languageField: "Language",
    scopeNote:
      "E-book Mode is a reading preview. Export either the current file or the whole book.",
    title: "EPUB Export",
    titleField: "Title",
    noCoverImage: "Not selected",
  };
}
