import type { MarkdownStructureItem } from "../../features/editor/markdownStructure";

export interface OutlinePaneCopy {
  documentOutline: string;
  outlineEmpty: string;
  outlinePageBreak: string;
  outlineTrailingPageBreak: string;
  outlineTruncated: string;
}

export function OutlinePane({
  copy,
  currentHeadingLine,
  items,
  onSelect,
  truncated,
}: {
  copy: OutlinePaneCopy;
  currentHeadingLine: number | null;
  items: MarkdownStructureItem[];
  onSelect: (item: MarkdownStructureItem) => void;
  truncated: boolean;
}) {
  return (
    <div className="outline-pane">
      <div className="outline-pane-header">
        <span>{copy.documentOutline}</span>
      </div>
      {items.length > 0 ? (
        <>
          <div className="outline-list">
            {items.map((item) => {
              const isHeading = item.kind === "heading";
              const label = isHeading
                ? item.text
                : item.role === "drop"
                  ? copy.outlineTrailingPageBreak
                  : copy.outlinePageBreak;
              const current =
                isHeading && item.line === currentHeadingLine;

              return (
                <button
                  aria-label={`${item.line}: ${label}`}
                  aria-current={current ? "location" : undefined}
                  className={`outline-item outline-item-${item.kind}${current ? " current" : ""}`}
                  key={`${item.kind}-${item.startOffset}`}
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
