import type { MarkdownFormat } from "./EditorPane";
import { LinkIcon } from "../app/Icons";

export interface MarkdownQuickActionsCopy {
  link: string;
  linkTitle: string;
  markdownHelpers: string;
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
