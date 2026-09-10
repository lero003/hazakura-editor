import { getExportFormatNavCopy } from "../../lib/locale/exportFormatNav";
import type { MenuLanguage } from "../../types";

export type ExportFormatId = "epub" | "pdf" | "html";

type Props = {
  /** いま開いている形式。 */
  format: ExportFormatId;
  menuLanguage: MenuLanguage;
  /** 別の形式へ切り替える（各形式の既存の準備処理を呼ぶ）。 */
  onSelectFormat: (format: ExportFormatId) => void;
};

/**
 * 書き出しの形式ナビ（画面11）。共通のダイアログ枠に置き、同じ画面で形式を選ぶ。
 * 選んだ形式の設定と対象（文書／本全体）は、その形式の既存ダイアログがそのまま担う。
 */
export function ExportFormatNav({ format, menuLanguage, onSelectFormat }: Props) {
  const copy = getExportFormatNavCopy(menuLanguage);
  const items: { id: ExportFormatId; label: string }[] = [
    { id: "epub", label: copy.epub },
    { id: "pdf", label: copy.pdf },
    { id: "html", label: copy.html },
  ];
  return (
    <div
      aria-label={copy.groupLabel}
      className="export-format-nav"
      role="group"
    >
      {items.map((item) => (
        <button
          aria-pressed={item.id === format}
          className="export-format-nav-button"
          key={item.id}
          onClick={() => {
            if (item.id !== format) onSelectFormat(item.id);
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
