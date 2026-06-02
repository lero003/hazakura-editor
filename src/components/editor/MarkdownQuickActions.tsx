import type { MarkdownFormat } from "./EditorPane";
import { LinkIcon } from "../app/Icons";

export interface MarkdownQuickActionsCopy {
  italic: string;
  italicTitle: string;
  link: string;
  linkTitle: string;
  markdownHelpers: string;
  strong: string;
  strongTitle: string;
}

export function MarkdownQuickActions({
  copy,
  onApplyMarkdownFormat,
}: {
  copy: MarkdownQuickActionsCopy;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
}) {
  return (
    <div className="markdown-quick-actions" aria-label={copy.markdownHelpers}>
      <button
        aria-label={copy.strong}
        className="markdown-quick-action strong"
        onClick={() => onApplyMarkdownFormat("bold")}
        title={copy.strongTitle}
        type="button"
      >
        <span aria-hidden="true">B</span>
      </button>
      <button
        aria-label={copy.italic}
        className="markdown-quick-action italic"
        onClick={() => onApplyMarkdownFormat("italic")}
        title={copy.italicTitle}
        type="button"
      >
        <span aria-hidden="true">I</span>
      </button>
      <button
        aria-label={copy.link}
        className="markdown-quick-action"
        onClick={() => onApplyMarkdownFormat("link")}
        title={copy.linkTitle}
        type="button"
      >
        <LinkIcon />
      </button>
    </div>
  );
}
