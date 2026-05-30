import { type MouseEvent, useMemo } from "react";
import { renderMarkdown } from "../markdown";

type PreviewPaneProps = {
  onOpenLocalLink?: (href: string) => void;
  source: string;
};

export default function PreviewPane({
  onOpenLocalLink,
  source,
}: PreviewPaneProps) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!onOpenLocalLink) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[href]");

    if (!link || !event.currentTarget.contains(link)) {
      return;
    }

    const href = link.getAttribute("href")?.trim() ?? "";

    event.preventDefault();
    onOpenLocalLink(href);
  };

  return (
    <article
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
