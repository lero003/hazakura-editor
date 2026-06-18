// v0.22 e-book Mode MVP — display-only active chapter reader.
//
// This is still Path Y: Markdown is rendered through the existing
// `renderMarkdown()` / `inlineWorkspaceAssetImages()` safety pipeline,
// never through CodeMirror decoration. The Markdown source is never
// edited here; this pane is read-only by construction (it only sets
// `dangerouslySetInnerHTML` on sanitised HTML, with no input or
// contenteditable surface).
//
// v0.22 changes the v0.21 continuous-scroll PoC into a chapter reader:
// only the active chapter is rendered into the DOM, and previous / next
// controls move between chapter segments. Coexistence with L Mode is
// intentional: L Mode remains the Live Source writing surface, while
// this pane is a separate, HTML-rendered reading surface.

import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { splitMarkdownIntoChapters } from "../../../features/editor/ebookChapters";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { openWorkspaceImage } from "../../../lib/tauri";
import type { MenuLanguage } from "../../../types";
import { isJapaneseMenuLanguage } from "../../../types";

type EBookPaneProps = {
  documentPath?: string | null;
  menuLanguage?: MenuLanguage;
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

type EBookReaderCopy = {
  body: string;
  frontMatter: string;
  nextChapter: string;
  previousChapter: string;
  readerLabel: string;
};

export default function EBookPane({
  documentPath,
  menuLanguage = "en",
  onOpenLocalLink,
  source,
  workspaceRoot,
}: EBookPaneProps) {
  const copy = getEBookReaderCopy(menuLanguage);
  const chapters = useMemo(() => splitMarkdownIntoChapters(source), [source]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  useEffect(() => {
    setActiveChapterIndex(0);
  }, [documentPath]);

  useEffect(() => {
    setActiveChapterIndex((current) =>
      clampChapterIndex(current, chapters.length),
    );
  }, [chapters.length]);

  const activeChapterIndexSafe = clampChapterIndex(
    activeChapterIndex,
    chapters.length,
  );
  const activeChapter = chapters[activeChapterIndexSafe] ?? chapters[0];
  const activeRenderedChapter = useMemo<RenderedChapter | null>(() => {
    if (!activeChapter) {
      return null;
    }

    return {
      index: activeChapter.index,
      headingLevel: activeChapter.headingLevel,
      headingText: activeChapter.headingText,
      html: renderMarkdown(activeChapter.source, {
        documentPath,
        workspaceRoot,
      }),
    };
  }, [activeChapter, documentPath, workspaceRoot]);

  const [activeChapterHtml, setActiveChapterHtml] =
    useState<RenderedChapter | null>(activeRenderedChapter);

  useEffect(() => {
    let cancelled = false;
    setActiveChapterHtml(activeRenderedChapter);

    if (!activeRenderedChapter || !workspaceRoot) {
      return () => {
        cancelled = true;
      };
    }

    // Inline workspace images for the visible chapter only. This keeps
    // the Preview safety boundary while avoiding the v0.21 all-chapter
    // rebuild cost.
    void inlineWorkspaceAssetImages(
      activeRenderedChapter.html,
      async (path) => {
        const image = await openWorkspaceImage(workspaceRoot, path);
        return image.dataUrl;
      },
    ).then((inlined) => {
      if (!cancelled) {
        setActiveChapterHtml({
          ...activeRenderedChapter,
          html: inlined,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeRenderedChapter, workspaceRoot]);

  const goToPreviousChapter = () => {
    setActiveChapterIndex((current) => Math.max(current - 1, 0));
  };

  const goToNextChapter = () => {
    setActiveChapterIndex((current) =>
      Math.min(current + 1, Math.max(chapters.length - 1, 0)),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPreviousChapter();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToNextChapter();
    }
  };

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

  const totalChapters = chapters.length;
  const chapterLabel = chapterNavigationLabel(
    activeChapter ?? null,
    activeChapterIndexSafe,
    totalChapters,
    copy,
  );

  return (
    <article
      aria-label={copy.readerLabel}
      className="ebook-pane markdown-preview"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <header className="ebook-reader-chrome">
        <button
          className="ebook-reader-button"
          disabled={activeChapterIndexSafe === 0}
          onClick={goToPreviousChapter}
          type="button"
        >
          {copy.previousChapter}
        </button>
        <div className="ebook-reader-status">
          <div className="ebook-reader-title" title={chapterLabel}>
            {chapterLabel}
          </div>
          <div className="ebook-reader-progress">
            {activeChapterIndexSafe + 1} / {totalChapters}
          </div>
        </div>
        <button
          className="ebook-reader-button"
          disabled={activeChapterIndexSafe >= totalChapters - 1}
          onClick={goToNextChapter}
          type="button"
        >
          {copy.nextChapter}
        </button>
      </header>
      {activeChapterHtml ? (
        <section
          className={chapterClassName(
            activeChapterHtml,
            activeChapterIndexSafe,
          )}
        >
          <div dangerouslySetInnerHTML={{ __html: activeChapterHtml.html }} />
        </section>
      ) : null}
    </article>
  );
}

function clampChapterIndex(index: number, totalChapters: number): number {
  if (totalChapters <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), totalChapters - 1);
}

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
  chapter: Pick<RenderedChapter, "headingText"> | null,
  position: number,
  totalChapters: number,
  copy: EBookReaderCopy,
): string {
  const headingText = chapter?.headingText?.trim();
  if (headingText) {
    return headingText;
  }
  if (totalChapters === 1) {
    return copy.body;
  }
  if (position === 0) {
    return copy.frontMatter;
  }
  return `${position + 1} / ${totalChapters}`;
}

function getEBookReaderCopy(
  menuLanguage: MenuLanguage,
): EBookReaderCopy {
  if (menuLanguage === "kana") {
    return {
      body: "本文",
      frontMatter: "前付",
      nextChapter: "つぎの章",
      previousChapter: "まへの章",
      readerLabel: "章送り",
    };
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      body: "本文",
      frontMatter: "前付",
      nextChapter: "次の章",
      previousChapter: "前の章",
      readerLabel: "章送り",
    };
  }

  return {
    body: "Body",
    frontMatter: "Front matter",
    nextChapter: "Next chapter",
    previousChapter: "Previous chapter",
    readerLabel: "Chapter reader",
  };
}
