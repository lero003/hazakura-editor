import { ExportDialogFrame } from "./ExportDialogFrame";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  PDF_MARGIN_PRESETS,
  type PdfMarginPreset,
} from "../../features/document/pdfExport";
import type { MenuLanguage } from "../../types";
import { ExportPreflightSummary } from "./ExportPreflightSummary";
import type { DocumentExportScope } from "../../features/document/exportScope";
import { ExportScopeSelector } from "./ExportScopeSelector";
import type { ExportPreflightResult } from "../../features/document/exportPreflight";

type PdfExportSettingsDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  bookAvailable?: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  documentName: string;
  initialPreset: PdfMarginPreset;
  hasUnsavedChanges: boolean;
  initialScope?: DocumentExportScope;
  /** 形式を選ぶ入口（画面11）。 */
  formatNav?: ReactNode;
  /** 形式を切り替えても入力を保つための通知（画面11）。 */
  onDraftChange?: (preset: PdfMarginPreset, scope: DocumentExportScope) => void;
  menuLanguage: MenuLanguage;
  preflightByScope?: Record<DocumentExportScope, ExportPreflightResult>;
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
  formatNav,
  onDraftChange,
  menuLanguage,
  preflightByScope,
  onCancel,
  onConfirm,
}: PdfExportSettingsDialogProps) {
  const copy = getPdfExportSettingsCopy(menuLanguage);
  const [preset, setPreset] = useState<PdfMarginPreset>(initialPreset);
  const [scope, setScope] = useState<DocumentExportScope>(initialScope);
  useEffect(() => {
    onDraftChange?.(preset, scope);
  }, [preset, scope, onDraftChange]);
  const hasBlockingIssue = preflightByScope?.[scope].issues.some(
    (issue) => issue.severity === "error",
  ) ?? false;

  return (
    <ExportDialogFrame format="PDF" title={copy.title} documentName={documentName}
      scope={scope} formatNav={formatNav} menuLanguage={menuLanguage} dialogRef={dialogRef} cancelButtonRef={cancelButtonRef}
      canConfirm={!hasBlockingIssue && (scope === "document" || bookAvailable)}
      confirmLabel={copy.export} cancelLabel={copy.cancel} onCancel={onCancel}
      onConfirm={() => onConfirm(preset, scope)}>
        <p className="pdf-export-settings-note">{copy.scopeNote}</p>
        {bookAvailable ? (
          <ExportScopeSelector
            menuLanguage={menuLanguage}
            onChange={setScope}
            value={scope}
          />
        ) : null}

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
        <ExportPreflightSummary
          format="PDF"
          hasUnsavedChanges={hasUnsavedChanges}
          menuLanguage={menuLanguage}
          preflight={preflightByScope?.[scope]}
        />
    </ExportDialogFrame>
  );
}

function getPdfExportSettingsCopy(menuLanguage: MenuLanguage) {
  if (menuLanguage === "kana") {
    return {
      cancel: "やめる",
      export: "かきだしさきを えらぶ",
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
      export: "書き出し先を選ぶ",
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
    export: "Choose destination…",
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
