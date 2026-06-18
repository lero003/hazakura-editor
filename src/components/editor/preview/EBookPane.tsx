// v0.21 e-book Mode PoC — display-only book-like reading surface.
//
// This is Path Y from the v0.21 plan: it renders Markdown through the
// existing `renderMarkdown()` / `inlineWorkspaceAssetImages()` safety
// pipeline, never through CodeMirror decoration. The Markdown source is
// never edited here; this pane is read-only by construction (it only
// sets `dangerouslySetInnerHTML` on sanitised HTML, with no input or
// contenteditable surface).
//
// The chapter split happens before rendering: the source is split into
// ATX-heading chapter segments and each segment is rendered through
// `renderMarkdown()` independently, so a `<script>` / `<iframe>` /
// external image inside one chapter cannot reach the others and the
// same DOMPurify + workspace-image boundary that protects Preview also
// protects this surface.
//
// Coexistence with L Mode is intentional: L Mode is the CodeMirror
// Live Source writing surface; this pane is a separate, HTML-rendered
// reading surface. The two do not share state. See
// docs/ebook-mode-epub-export-plan.md (Relationship To L Mode).

import {
  type MouseEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { splitMarkdownIntoChapters } from "../../../features/editor/ebookChapters";
import { openWorkspaceImage } from "../../../lib/tauri";

type EBookPaneProps = {
  documentPath?: string | null;
  onOpenLocalLink?: (href: string) => void;
  source: string;
  workspaceRoot?: string | null;
};

type RenderedChapter = {
  index: number;
  headingLevel: number | null;
  headingText: string | null;
  html: string;
};

export default function EBookPane({
  documentPath,
  onOpenLocalLink,
  source,
  workspaceRoot,
}: EBookPaneProps) {
  // Keep editor input responsive while this display-only surface rebuilds
  // its sanitised HTML for long prose / image-heavy documents.
  const deferredSource = useDeferredValue(source);
  const chapterElementsRef = useRef(new Map<number, HTMLElement>());

  // Split once per source; chapter boundaries are a pure function of
  // the Markdown text, so they are memoised independently of rendering.
  const chapters = useMemo(
    () => splitMarkdownIntoChapters(deferredSource),
    [deferredSource],
  );

  // Each chapter is rendered through `renderMarkdown()` so the same
  // sanitisation, image, table, and task policies apply per chapter.
  const renderedChapters = useMemo<RenderedChapter[]>(
    () =>
      chapters.map((chapter) => ({
        index: chapter.index,
        headingLevel: chapter.headingLevel,
        headingText: chapter.headingText,
        html: renderMarkdown(chapter.source, {
          documentPath,
          workspaceRoot,
        }),
      })),
    [chapters, documentPath, workspaceRoot],
  );

  const [chaptersHtml, setChaptersHtml] =
    useState<RenderedChapter[]>(renderedChapters);

  useEffect(() => {
    let cancelled = false;
    setChaptersHtml(renderedChapters);

    if (!workspaceRoot) {
      return () => {
        cancelled = true;
      };
    }

    // Inline workspace images per chapter, mirroring PreviewPane. Each
    // chapter's image resolution is independent so a slow / blocked
    // image in one chapter does not stall the others.
    void Promise.all(
      renderedChapters.map(async (chapter) => {
        const inlined = await inlineWorkspaceAssetImages(
          chapter.html,
          async (path) => {
            const image = await openWorkspaceImage(workspaceRoot, path);
            return image.dataUrl;
          },
        );
        return { ...chapter, html: inlined };
      }),
    ).then((resolved) => {
      if (!cancelled) {
        setChaptersHtml(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [renderedChapters, workspaceRoot]);

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

  const scrollToChapter = (chapterIndex: number) => {
    chapterElementsRef.current.get(chapterIndex)?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

  return (
    <article
      className="ebook-pane markdown-preview"
      onClick={handleClick}
    >
      <nav className="ebook-nav" aria-label="章">
        <div className="ebook-nav-list">
          {chaptersHtml.map((chapter, position) => {
            const label = chapterNavigationLabel(
              chapter,
              position,
              chaptersHtml.length,
            );
            return (
              <button
                className="ebook-nav-item"
                key={chapter.index}
                onClick={() => scrollToChapter(chapter.index)}
                title={label}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      {chaptersHtml.map((chapter, position) => (
        <section
          key={chapter.index}
          className={chapterClassName(chapter, position)}
          ref={(element) => {
            if (element) {
              chapterElementsRef.current.set(chapter.index, element);
            } else {
              chapterElementsRef.current.delete(chapter.index);
            }
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
        </section>
      ))}
    </article>
  );
}

// Compose the per-chapter class so the stylesheet can render a
// front-matter / cover treatment for the opening segment and a
// chapter-opener treatment for the rest, without the component owning
// any styling of its own. `position` is the rendered ordinal (0-based)
// so a dropped empty preamble still makes the first visible chapter the
// cover candidate.
function chapterClassName(
  chapter: RenderedChapter,
  position: number,
): string {
  const classes = ["ebook-chapter"];
  if (position === 0) {
    classes.push("ebook-chapter-opener");
    if (chapter.headingLevel === 1 && chapter.headingText) {
      classes.push("ebook-chapter-cover");
    } else {
      classes.push("ebook-chapter-frontmatter");
    }
  }
  if (chapter.headingText === null) {
    classes.push("ebook-chapter-preamble");
  }
  return classes.join(" ");
}

function chapterNavigationLabel(
  chapter: RenderedChapter,
  position: number,
  totalChapters: number,
): string {
  const headingText = chapter.headingText?.trim();
  if (headingText) {
    return headingText;
  }
  if (totalChapters === 1) {
    return "本文";
  }
  if (position === 0) {
    return "前付";
  }
  return `章 ${position + 1}`;
}
