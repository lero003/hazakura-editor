import type { MarkdownStructureItem } from "../../features/editor/markdownStructure";
import type { MarkdownStructureAdvisory } from "../../features/editor/markdownStructureAdvisories";
import type { HeadingLevelChangeDirection } from "../../features/editor/markdownStructureEdits";

export interface OutlinePaneCopy {
  documentOutline: string;
  outlineEmpty: string;
  outlineEmptyHeading: string;
  outlineAdvisorySummary: (count: number) => string;
  outlineSkippedLevel: (previousLevel: number, level: number) => string;
  outlineDuplicateLabel: (firstLine: number) => string;
  outlineLongSection: (lineCount: number) => string;
  outlinePromoteHeading: (label: string) => string;
  outlineDemoteHeading: (label: string) => string;
  outlinePageBreak: string;
  outlineTrailingPageBreak: string;
  outlineTruncated: string;
}

export function OutlinePane({
  copy,
  currentHeadingLine,
  advisories,
  items,
  onChangeHeadingLevel,
  onSelect,
  truncated,
}: {
  copy: OutlinePaneCopy;
  currentHeadingLine: number | null;
  advisories: MarkdownStructureAdvisory[];
  items: MarkdownStructureItem[];
  onChangeHeadingLevel: (
    heading: Extract<MarkdownStructureItem, { kind: "heading" }>,
    direction: HeadingLevelChangeDirection,
  ) => void;
  onSelect: (item: MarkdownStructureItem) => void;
  truncated: boolean;
}) {
  return (
    <div className="outline-pane">
      <div className="outline-pane-header">
        <span>{copy.documentOutline}</span>
        {advisories.length > 0 ? (
          <span className="outline-advisory-summary" role="note">
            {copy.outlineAdvisorySummary(advisories.length)}
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <>
          <div className="outline-list">
            {items.map((item) => {
              const isHeading = item.kind === "heading";
              const label = isHeading
                ? item.text || copy.outlineEmptyHeading
                : item.role === "drop"
                  ? copy.outlineTrailingPageBreak
                  : copy.outlinePageBreak;
              const current =
                isHeading && item.line === currentHeadingLine;
              const itemAdvisories = advisories.filter(
                (advisory) => advisory.line === item.line,
              );

              return (
                <div
                  className="outline-entry"
                  key={`${item.kind}-${item.startOffset}`}
                >
                  <div className="outline-entry-row">
                    <button
                      aria-label={`${item.line}: ${label}`}
                      aria-current={current ? "location" : undefined}
                      className={`outline-item outline-item-${item.kind}${current ? " current" : ""}`}
                      onClick={() => onSelect(item)}
                      style={{
                        paddingLeft: isHeading
                          ? `${10 + (item.level - 1) * 12}px`
                          : "10px",
                      }}
                      title={`${item.line}: ${label}`}
                      type="button"
                    >
                      <span className="outline-line">{item.line}</span>
                      <span className="outline-text">{label}</span>
                    </button>
                    {isHeading ? (
                      <span className="outline-heading-actions">
                        <button
                          aria-label={`${item.line}: ${copy.outlinePromoteHeading(label)}`}
                          className="outline-heading-level-button"
                          disabled={item.level <= 1}
                          onClick={() => onChangeHeadingLevel(item, "promote")}
                          title={copy.outlinePromoteHeading(label)}
                          type="button"
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`${item.line}: ${copy.outlineDemoteHeading(label)}`}
                          className="outline-heading-level-button"
                          disabled={item.level >= 6}
                          onClick={() => onChangeHeadingLevel(item, "demote")}
                          title={copy.outlineDemoteHeading(label)}
                          type="button"
                        >
                          ↓
                        </button>
                      </span>
                    ) : null}
                  </div>
                  {itemAdvisories.map((advisory) => (
                    <div
                      className="outline-advisory"
                      key={`${advisory.kind}-${advisory.line}`}
                      role="note"
                    >
                      {formatAdvisory(advisory, copy)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {truncated ? (
            <div className="outline-truncated" role="note">
              {copy.outlineTruncated}
            </div>
          ) : null}
        </>
      ) : (
        <div className="outline-empty">{copy.outlineEmpty}</div>
      )}
    </div>
  );
}

function formatAdvisory(
  advisory: MarkdownStructureAdvisory,
  copy: OutlinePaneCopy,
): string {
  switch (advisory.kind) {
    case "skipped-level":
      return copy.outlineSkippedLevel(advisory.previousLevel, advisory.level);
    case "empty-heading":
      return copy.outlineEmptyHeading;
    case "duplicate-navigation-label":
      return copy.outlineDuplicateLabel(advisory.firstLine);
    case "long-section":
      return copy.outlineLongSection(advisory.lineCount);
  }
}
