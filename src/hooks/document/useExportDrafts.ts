import { useCallback, useState } from "react";
import type { DocumentExportScope } from "../../features/document/exportScope";
import type { EpubExportSettings } from "../../features/document/epubExport";
import type { PdfMarginPreset } from "../../features/document/pdfExport";

/**
 * 書き出しダイアログの入力草稿（画面11）。
 *
 * 形式ナビで EPUB↔PDF↔HTML を行き来しても、**一度の書き出し操作のあいだ**は
 * 書名・著者・表紙・余白と、対象（文書／本全体）を保つ。保存や永続化はしない
 * （画面を閉じれば消える）。
 *
 * 文書の identity を草稿と一緒に持つ。effect で消す方式にすると、文書を切り替えた
 * **最初の render** では前の文書の草稿がまだ残り、その値を初期値として読んでしまう。
 */
export type ExportDraftState = {
  scope?: DocumentExportScope;
  epub?: EpubExportSettings;
  pdf?: PdfMarginPreset;
};

type StoredDrafts = { documentKey: string; drafts: ExportDraftState };

export function useExportDrafts(documentKey: string | null) {
  const key = documentKey ?? "";
  const [stored, setStored] = useState<StoredDrafts>({ documentKey: "", drafts: {} });
  const drafts = stored.documentKey === key ? stored.drafts : {};

  const remember = useCallback(
    (patch: ExportDraftState) => {
      setStored((current) => ({
        documentKey: key,
        drafts: {
          ...(current.documentKey === key ? current.drafts : {}),
          ...patch,
        },
      }));
    },
    [key],
  );

  /**
   * 書き出し操作の終了（利用者のキャンセル・確定）で草稿を捨てる。
   * **形式切替の内部キャンセルでは呼ばない**（切替は同じ操作の途中）。
   */
  const clear = useCallback(() => {
    setStored((current) =>
      current.documentKey === key ? { documentKey: key, drafts: {} } : current,
    );
  }, [key]);

  const rememberEpub = useCallback(
    (epub: EpubExportSettings, scope: DocumentExportScope) => {
      remember({ epub, scope });
    },
    [remember],
  );

  const rememberPdf = useCallback(
    (pdf: PdfMarginPreset, scope: DocumentExportScope) => {
      remember({ pdf, scope });
    },
    [remember],
  );

  return { clear, drafts, rememberEpub, rememberPdf };
}
