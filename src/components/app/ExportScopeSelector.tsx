import type { DocumentExportScope } from "../../features/document/exportScope";
import type { MenuLanguage } from "../../types";

type Props = {
  menuLanguage: MenuLanguage;
  onChange: (scope: DocumentExportScope) => void;
  value: DocumentExportScope;
};

export function ExportScopeSelector({ menuLanguage, onChange, value }: Props) {
  const copy = menuLanguage === "en"
    ? { legend: "Export range", document: "Current file", book: "Book Scope" }
    : menuLanguage === "kana"
      ? { legend: "かきだす はんい", document: "いまの ファイル", book: "Book Scope" }
      : { legend: "書き出す範囲", document: "現在のファイル", book: "Book Scope" };
  return (
    <fieldset className="export-scope-selector">
      <legend>{copy.legend}</legend>
      <label>
        <input
          checked={value === "document"}
          name="document-export-scope"
          onChange={() => onChange("document")}
          type="radio"
          value="document"
        />
        <span>{copy.document}</span>
      </label>
      <label>
        <input
          checked={value === "book"}
          name="document-export-scope"
          onChange={() => onChange("book")}
          type="radio"
          value="book"
        />
        <span>{copy.book}</span>
      </label>
    </fieldset>
  );
}
