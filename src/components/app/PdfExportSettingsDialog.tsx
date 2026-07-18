import { useState, type RefObject } from "react";
import {
  PDF_MARGIN_PRESETS,
  type PdfMarginPreset,
} from "../../features/document/pdfExport";
import type { MenuLanguage } from "../../types";
import { ExportPreflightSummary } from "./ExportPreflightSummary";
import type { DocumentExportScope } from "../../features/document/exportScope";
import { ExportScopeSelector } from "./ExportScopeSelector";

type PdfExportSettingsDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  bookAvailable?: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  documentName: string;
  initialPreset: PdfMarginPreset;
  hasUnsavedChanges: boolean;
  initialScope?: DocumentExportScope;
  menuLanguage: MenuLanguage;
  onCancel: () => void;
  onConfirm: (preset: PdfMarginPreset, scope: DocumentExportScope) => void;
};

export function PdfExportSettingsDialog({
  bookAvailable = false,
  cancelButtonRef,
  dialogRef,
  documentName,
  initialPreset,
  hasUnsavedChanges,
  initialScope = "document",
  menuLanguage,
  onCancel,
  onConfirm,
}: PdfExportSettingsDialogProps) {
  const copy = getPdfExportSettingsCopy(menuLanguage);
  const [preset, setPreset] = useState<PdfMarginPreset>(initialPreset);
  const [scope, setScope] = useState<DocumentExportScope>(initialScope);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="pdf-export-settings-description"
        aria-labelledby="pdf-export-settings-title"
        aria-modal="true"
        className="close-dialog pdf-export-settings-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="pdf-export-settings-title">{copy.title}</h2>
        <p id="pdf-export-settings-description" title={documentName}>
          {documentName}
        </p>
        <p className="pdf-export-settings-note">{copy.scopeNote}</p>
        {bookAvailable ? (
          <ExportScopeSelector
            menuLanguage={menuLanguage}
            onChange={setScope}
            value={scope}
          />
        ) : null}
        <ExportPreflightSummary
          format="PDF"
          hasUnsavedChanges={hasUnsavedChanges}
          menuLanguage={menuLanguage}
        />
        <form
          className="pdf-export-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(preset, scope);
          }}
        >
          <fieldset className="pdf-margin-presets">
            <legend>{copy.marginLabel}</legend>
            {(
              ["narrow", "standard", "wide"] as const satisfies readonly PdfMarginPreset[]
            ).map((value) => {
              const margin = PDF_MARGIN_PRESETS[value];
              return (
                <label className="pdf-margin-preset" key={value}>
                  <input
                    autoFocus={value === initialPreset}
                    checked={preset === value}
                    name="pdf-margin-preset"
                    onChange={() => setPreset(value)}
                    type="radio"
                    value={value}
                  />
                  <span>
                    <strong>{copy.presets[value]}</strong>
                    <small>
                      {copy.marginDescription(
                        margin.blockMm,
                        margin.inlineMm,
                      )}
                    </small>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="dialog-actions">
            <button type="submit">{copy.export}</button>
            <button ref={cancelButtonRef} type="button" onClick={onCancel}>
              {copy.cancel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getPdfExportSettingsCopy(menuLanguage: MenuLanguage) {
  if (menuLanguage === "kana") {
    return {
      cancel: "やめる",
      export: "かきだす",
      marginDescription: (blockMm: number, inlineMm: number) =>
        `うえした ${blockMm} mm・ひだりみぎ ${inlineMm} mm`,
      marginLabel: "A4の よはく",
      presets: {
        narrow: "せまい",
        standard: "ふつう",
        wide: "ひろい",
      },
      scopeNote: "かみの おおきさは A4です。よはくだけ えらびます。",
      title: "PDFかきだし",
    };
  }

  if (menuLanguage === "ja") {
    return {
      cancel: "キャンセル",
      export: "書き出す",
      marginDescription: (blockMm: number, inlineMm: number) =>
        `上下 ${blockMm} mm・左右 ${inlineMm} mm`,
      marginLabel: "A4余白",
      presets: {
        narrow: "狭い",
        standard: "標準",
        wide: "広い",
      },
      scopeNote: "用紙サイズはA4固定です。余白だけを選択します。",
      title: "PDF書き出し",
    };
  }

  return {
    cancel: "Cancel",
    export: "Export",
    marginDescription: (blockMm: number, inlineMm: number) =>
      `Top/bottom ${blockMm} mm · Left/right ${inlineMm} mm`,
    marginLabel: "A4 margins",
    presets: {
      narrow: "Narrow",
      standard: "Standard",
      wide: "Wide",
    },
    scopeNote: "The page size stays fixed at A4. Only the margins change.",
    title: "PDF Export",
  };
}
