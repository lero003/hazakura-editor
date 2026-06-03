import type { MarkdownHeadingContext, MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

export function ScrollPositionHud({
  context,
  line,
  menuLanguage,
  totalLines,
}: {
  context: MarkdownHeadingContext;
  line: number;
  menuLanguage: MenuLanguage;
  totalLines: number;
}) {
  const progress =
    totalLines <= 1 ? 0 : Math.round(((line - 1) / (totalLines - 1)) * 100);
  const lineUnit = isKanaStyle(menuLanguage)
    ? "ぎょう"
    : isJapaneseMenuLanguage(menuLanguage)
      ? "行"
      : "lines";
  const meta = `${line.toLocaleString()} / ${totalLines.toLocaleString()} ${lineUnit} · ${progress}%`;

  return (
    <div className="scroll-position-hud" aria-hidden="true">
      {context.previous ? (
        <div className="scroll-position-hud-neighbor">
          {context.previous.text}
        </div>
      ) : null}
      <div className="scroll-position-hud-current">
        <span>§</span>
        <strong>{context.current?.text}</strong>
      </div>
      {context.next ? (
        <div className="scroll-position-hud-neighbor next">
          {context.next.text}
        </div>
      ) : null}
      <div className="scroll-position-hud-meta">{meta}</div>
    </div>
  );
}
