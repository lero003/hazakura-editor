import type { MenuLanguage } from "../../types";
import type { ExportPreflightResult } from "../../features/document/exportPreflight";

type ExportPreflightSummaryProps = {
  format: "EPUB" | "PDF";
  hasUnsavedChanges: boolean;
  menuLanguage: MenuLanguage;
  metadataMissing?: readonly string[];
  preflight?: ExportPreflightResult;
};

export function ExportPreflightSummary({
  format,
  hasUnsavedChanges,
  menuLanguage,
  metadataMissing = [],
  preflight,
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
      {preflight ? (
        <div>
          <dt>{copy.structureLabel}</dt>
          <dd>
            {copy.chapterCount(preflight.chapterCount)}
            {preflight.issues.length > 0 ? (
              <ul className="export-preflight-issues">
                {preflight.issues.map((issue, index) => (
                  <li
                    data-severity={issue.severity}
                    key={`${issue.kind}:${issue.subject}:${index}`}
                  >
                    {copy.issue(issue.kind, issue.subject)}
                  </li>
                ))}
              </ul>
            ) : null}
          </dd>
        </div>
      ) : null}
      {metadataMissing.length > 0 ? (
        <div>
          <dt>{copy.metadataLabel}</dt>
          <dd>{copy.metadataMissing(metadataMissing)}</dd>
        </div>
      ) : null}
      <div>
        <dt>{copy.imagesLabel}</dt>
        <dd>
          {preflight && preflight.checkedImageCount > 0
            ? `${copy.imagesChecked(preflight.checkedImageCount)} ${copy.images}`
            : copy.images}
        </dd>
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
      chapterCount: (count: number) => `${count}しょうを かくにん。`,
      images:
        "ところの がぞうは かきだすときに たしかめます。よめない がぞうは ちゅういとして しらせます。",
      imagesLabel: "がぞう",
      imagesChecked: (count: number) => `${count}けんを じぜんに かくにんしました。`,
      issue: issueCopyKana,
      metadataLabel: "しょしじょうほう",
      metadataMissing: (fields: readonly string[]) => `${fields.join("・")}が まだ ありません。`,
      savedSource: "いまの ふみと おなじです。",
      sourceLabel: "もとの ふみ",
      structureLabel: "こうせい",
      unsavedSource: "まだ ほぞんしていない かきかえも ふくみます。",
    };
  }
  if (menuLanguage === "ja") {
    return {
      destination: `次の保存ダイアログで .${extension} の保存先を選びます。`,
      destinationLabel: "出力先",
      chapterCount: (count: number) => `${count}章を確認。`,
      images:
        "ワークスペース画像は書き出し時に確認します。利用できない画像は警告として通知します。",
      imagesLabel: "画像",
      imagesChecked: (count: number) => `${count}件を事前に確認しました。`,
      issue: issueCopyJa,
      metadataLabel: "書誌情報",
      metadataMissing: (fields: readonly string[]) => `${fields.join("・")}が未入力です。`,
      savedSource: "現在の文書に未保存の変更はありません。",
      sourceLabel: "元の文書",
      structureLabel: "構成",
      unsavedSource: "現在の未保存の変更も書き出しに含めます。",
    };
  }
  return {
    destination: `Choose the .${extension} destination in the next Save dialog.`,
    destinationLabel: "Destination",
    chapterCount: (count: number) => `${count} chapter(s) checked.`,
    images:
      "Workspace images are checked during export. Unavailable images are reported as warnings.",
    imagesLabel: "Images",
    imagesChecked: (count: number) => `${count} image(s) checked in preflight.`,
    issue: issueCopyEn,
    metadataLabel: "Metadata",
    metadataMissing: (fields: readonly string[]) => `Missing: ${fields.join(", ")}.`,
    savedSource: "No unsaved changes are currently detected.",
    sourceLabel: "Source",
    structureLabel: "Structure",
    unsavedSource: "Current unsaved changes are included in the export.",
  };
}

function issueCopyJa(kind: string, subject: string): string {
  if (kind === "chapter-unavailable") return `利用できない章: ${subject}`;
  if (kind === "heading-missing") return `見出しがない章: ${subject}`;
  if (kind === "image-unavailable") return `読み込めない画像: ${subject}`;
  return `画像確認の上限を超えたため、残り${subject}件は未確認です。`;
}

function issueCopyKana(kind: string, subject: string): string {
  if (kind === "chapter-unavailable") return `つかえない しょう: ${subject}`;
  if (kind === "heading-missing") return `みだしが ない しょう: ${subject}`;
  if (kind === "image-unavailable") return `よめない がぞう: ${subject}`;
  return `のこり ${subject}けんの がぞうは みかくにんです。`;
}

function issueCopyEn(kind: string, subject: string): string {
  if (kind === "chapter-unavailable") return `Unavailable chapter: ${subject}`;
  if (kind === "heading-missing") return `Chapter without a heading: ${subject}`;
  if (kind === "image-unavailable") return `Unavailable image: ${subject}`;
  return `${subject} image(s) were not checked because the limit was reached.`;
}
