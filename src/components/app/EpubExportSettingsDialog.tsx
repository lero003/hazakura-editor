import { ExportDialogFrame } from "./ExportDialogFrame";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
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
  /** 形式を選ぶ入口（画面11）。 */
  formatNav?: ReactNode;
  /** 形式を切り替えても入力を保つための通知（画面11）。 */
  onDraftChange?: (settings: EpubExportSettings, scope: DocumentExportScope) => void;
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
  formatNav,
  onDraftChange,
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
  // 入力のたびに親へ知らせる（形式を切り替えても、同じ書き出し操作の間は保つ）。
  useEffect(() => {
    onDraftChange?.(
      { author, ...(coverImagePath ? { coverImagePath } : {}), language, title },
      scope,
    );
  }, [author, coverImagePath, language, scope, title, onDraftChange]);
  const titleValid = title.trim().length > 0;
  const hasBlockingIssue = preflightByScope?.[scope].issues.some(
    (issue) => issue.severity === "error",
  ) ?? false;

  return (
    <ExportDialogFrame format="EPUB" title={copy.title} documentName={documentName}
      scope={scope} formatNav={formatNav} menuLanguage={menuLanguage} dialogRef={dialogRef} cancelButtonRef={cancelButtonRef}
      canConfirm={titleValid && !hasBlockingIssue && (scope === "document" || bookAvailable)}
      confirmLabel={copy.export} cancelLabel={copy.cancel} onCancel={onCancel}
      onConfirm={() => onConfirm({ author, ...(coverImagePath ? { coverImagePath } : {}), language, title }, scope)}>
        <p className="epub-export-settings-note">{copy.scopeNote}</p>
        {bookAvailable ? (
          <ExportScopeSelector
            menuLanguage={menuLanguage}
            onChange={setScope}
            value={scope}
          />
        ) : null}

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
    </ExportDialogFrame>
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
      export: "かきだしさきを えらぶ",
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
      export: "書き出し先を選ぶ",
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
    export: "Choose destination…",
    languageField: "Language",
    scopeNote:
      "E-book Mode is a reading preview. Export either the current file or the whole book.",
    title: "EPUB Export",
    titleField: "Title",
    noCoverImage: "Not selected",
  };
}
