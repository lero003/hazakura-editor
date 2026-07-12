import type { MenuLanguage } from "../../types";

type ExportPreflightSummaryProps = {
  format: "EPUB" | "PDF";
  hasUnsavedChanges: boolean;
  menuLanguage: MenuLanguage;
};

export function ExportPreflightSummary({
  format,
  hasUnsavedChanges,
  menuLanguage,
}: ExportPreflightSummaryProps) {
  const copy = getExportPreflightCopy(format, menuLanguage);

  return (
    <dl className="export-preflight-summary">
      <div>
        <dt>{copy.sourceLabel}</dt>
        <dd>
          {hasUnsavedChanges ? copy.unsavedSource : copy.savedSource}
        </dd>
      </div>
      <div>
        <dt>{copy.imagesLabel}</dt>
        <dd>{copy.images}</dd>
      </div>
      <div>
        <dt>{copy.destinationLabel}</dt>
        <dd>{copy.destination}</dd>
      </div>
    </dl>
  );
}

function getExportPreflightCopy(
  format: "EPUB" | "PDF",
  menuLanguage: MenuLanguage,
) {
  const extension = format.toLowerCase();
  if (menuLanguage === "kana") {
    return {
      destination: `つぎの ほぞんまどで .${extension} の ほぞんさきを えらびます。`,
      destinationLabel: "ほぞんさき",
      images:
        "ところの がぞうは かきだすときに たしかめます。よめない がぞうは ちゅういとして しらせます。",
      imagesLabel: "がぞう",
      savedSource: "いまの ふみと おなじです。",
      sourceLabel: "もとの ふみ",
      unsavedSource: "まだ ほぞんしていない かきかえも ふくみます。",
    };
  }
  if (menuLanguage === "ja") {
    return {
      destination: `次の保存ダイアログで .${extension} の保存先を選びます。`,
      destinationLabel: "出力先",
      images:
        "ワークスペース画像は書き出し時に確認します。利用できない画像は警告として通知します。",
      imagesLabel: "画像",
      savedSource: "現在の文書に未保存の変更はありません。",
      sourceLabel: "元の文書",
      unsavedSource: "現在の未保存の変更も書き出しに含めます。",
    };
  }
  return {
    destination: `Choose the .${extension} destination in the next Save dialog.`,
    destinationLabel: "Destination",
    images:
      "Workspace images are checked during export. Unavailable images are reported as warnings.",
    imagesLabel: "Images",
    savedSource: "No unsaved changes are currently detected.",
    sourceLabel: "Source",
    unsavedSource: "Current unsaved changes are included in the export.",
  };
}
