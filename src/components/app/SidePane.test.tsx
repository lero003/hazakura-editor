import { createRef, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSidePaneCopy } from "../../lib/locale";
import { captureChangeReviewSnapshot } from "../../features/diff/changeReviewStale";
import {
  markdownStructureItems,
  parseMarkdownStructure,
} from "../../features/editor/markdownStructure";
import type { CompareCase, EditorTab, RightPaneMode } from "../../types";
import { SidePane } from "./SidePane";

afterEach(cleanup);

const activeTab: EditorTab = {
  contents: "plain text\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/plain.txt",
  sessionId: "/workspace/plain.txt",
  large_file_warning: false,
  lastSavedContents: "plain text\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "plain.txt",
  path: "/workspace/plain.txt",
  saveStatus: "idle",
  size: 11,
};

function renderSidePane(
  overrides: Partial<Parameters<typeof SidePane>[0]> = {},
) {
  return render(<SidePane {...sidePaneProps(overrides)} />);
}

function sidePaneProps(
  overrides: Partial<Parameters<typeof SidePane>[0]> = {},
): Parameters<typeof SidePane>[0] {
  return {
    activeContents: activeTab.contents,
    activeTab,
    compareSource: null,
    compareTarget: null,
    compareView: null,
    copy: getSidePaneCopy("en"),
    currentHeadingLine: null,
    documentStructureAdvisories: [],
    documentStructureItems: [],
    getCompareCaseByKey: () => undefined,
    menuLanguage: "en",
    onApplyBackup: vi.fn(),
    onClearCompareSource: vi.fn(),
    onClearCompareTarget: vi.fn(),
    onCloseCompareView: vi.fn(),
    ebookLocation: null,
    onEbookLocationChange: vi.fn(),
    onOpenEbookReadingFocus: vi.fn(),
    onOpenPreviewLocalLink: vi.fn(),
    onPreviewScroll: vi.fn(),
    onPreviewViewStateChange: vi.fn(),
    onRunSelectedFileCompare: vi.fn(),
    onChangeHeadingLevel: vi.fn(),
    onSelectHeading: vi.fn(),
    outlineTruncated: false,
    previewPaneRef: createRef<HTMLDivElement>(),
    previewViewState: null,
    previewVisible: true,
    sidePaneMode: "ebook",
    workspaceRootPath: "/workspace",
    ...overrides,
  };
}

describe("SidePane", () => {
  it("forwards an explicit heading-level change from the Outline surface", () => {
    const source = "## Chapter\nbody\n";
    const items = markdownStructureItems(parseMarkdownStructure(source));
    const onChangeHeadingLevel = vi.fn();

    renderSidePane({
      activeContents: source,
      documentStructureItems: items,
      onChangeHeadingLevel,
      sidePaneMode: "outline",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "1: Promote “Chapter” one level",
      }),
    );
    expect(onChangeHeadingLevel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "heading", level: 2, line: 1 }),
      "promote",
    );
  });

  it("reports and restores Preview scroll through the controlled view state", async () => {
    const previewPaneRef = createRef<HTMLDivElement>();
    const onPreviewScroll = vi.fn();
    const onPreviewViewStateChange = vi.fn();
    const firstTab = {
      ...activeTab,
      contents: "# First\n\nbody\n\n## More\n\nbody",
      id: "/workspace/first.md",
      name: "first.md",
      path: "/workspace/first.md",
    };
    const secondTab = {
      ...firstTab,
      contents: "# Second\n\nbody\n\n## More\n\nbody",
      id: "/workspace/second.md",
      name: "second.md",
      path: "/workspace/second.md",
    };
    const { rerender } = renderSidePane({
      activeContents: firstTab.contents,
      activeTab: firstTab,
      onPreviewScroll,
      onPreviewViewStateChange,
      previewPaneRef,
      previewViewState: null,
      sidePaneMode: "preview",
    });

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "First" })).toBeTruthy();
      },
      { timeout: 3_000 },
    );
    const previewContainer = previewPaneRef.current;
    expect(previewContainer).not.toBeNull();
    if (!previewContainer) throw new Error("preview container missing");
    Object.defineProperty(previewContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(previewContainer, "clientHeight", {
      configurable: true,
      value: 200,
    });
    previewContainer.scrollTop = 600;
    fireEvent.scroll(previewContainer);

    expect(onPreviewScroll).toHaveBeenCalledTimes(1);
    expect(onPreviewViewStateChange).toHaveBeenCalledWith({
      scrollRatio: 0.75,
    });

    rerender(
      <SidePane
        {...sidePaneProps({
          activeContents: secondTab.contents,
          activeTab: secondTab,
          onPreviewScroll,
          onPreviewViewStateChange,
          previewPaneRef,
          previewViewState: { scrollRatio: 0.25 },
          sidePaneMode: "preview",
        })}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Second" })).toBeTruthy();
        expect(previewContainer.scrollTop).toBe(200);
      },
      { timeout: 3_000 },
    );
  });

  it("keeps absolute Preview scroll across same-document edits that change height", async () => {
    const previewPaneRef = createRef<HTMLDivElement>();
    const firstContents = [
      "# Title",
      "",
      "Paragraph one.",
      "",
      "Paragraph two.",
      "",
      "Paragraph three.",
    ].join("\n");
    // Extra headings inflate rendered height after the debounce paint,
    // which used to re-apply a stale scroll ratio and jump the viewport.
    const editedContents = [
      "# Title",
      "",
      "## Section",
      "",
      "Paragraph one.",
      "",
      "### Subsection",
      "",
      "Paragraph two.",
      "",
      "Paragraph three.",
    ].join("\n");
    const tab = {
      ...activeTab,
      contents: firstContents,
      id: "/workspace/scroll-stable.md",
      name: "scroll-stable.md",
      path: "/workspace/scroll-stable.md",
    };

    const { rerender } = renderSidePane({
      activeContents: firstContents,
      activeTab: tab,
      previewPaneRef,
      // Stale ratio that would jump scrollTop if re-applied after height grows.
      previewViewState: { scrollRatio: 0.1 },
      sidePaneMode: "preview",
    });

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
      },
      { timeout: 3_000 },
    );

    const previewContainer = previewPaneRef.current;
    expect(previewContainer).not.toBeNull();
    if (!previewContainer) throw new Error("preview container missing");

    Object.defineProperty(previewContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(previewContainer, "clientHeight", {
      configurable: true,
      value: 200,
    });
    // Flush the initial ratio-restore rAF so it cannot overwrite the
    // mid-document position we set below.
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
    // Reader is mid-document. A stale ratio of 0.1 would jump this to 80
    // if same-document re-renders re-applied controlled view state.
    previewContainer.scrollTop = 480;

    rerender(
      <SidePane
        {...sidePaneProps({
          activeContents: editedContents,
          activeTab: { ...tab, contents: editedContents },
          previewPaneRef,
          previewViewState: { scrollRatio: 0.1 },
          sidePaneMode: "preview",
        })}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Section" })).toBeTruthy();
      },
      { timeout: 3_000 },
    );

    // Height changed, but same-document update must not re-apply ratio 0.1.
    expect(previewContainer.scrollTop).toBe(480);
  });

  it("shows a clear empty state for e-book mode when preview content is unavailable", () => {
    renderSidePane({ previewVisible: false });

    expect(screen.getByLabelText("Read as a book (e-book)")).toBeTruthy();
    expect(
      screen.getByText(
        "Preview is off in Preferences. Your source stays intact.",
      ),
    ).toBeTruthy();
  });

  it("shows a shared right-pane header and can hide the column", () => {
    const onHideSidePane = vi.fn();
    renderSidePane({
      onHideSidePane,
      sidePaneMode: "preview",
    });

    const header = screen.getByTestId("right-pane-header");
    expect(header.getAttribute("data-right-pane-mode")).toBe("preview");
    expect(screen.getByRole("heading", { name: "Preview" })).toBeTruthy();
    expect(
      screen.getByText("Continuous scroll to check layout"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close side pane" }));
    expect(onHideSidePane).toHaveBeenCalledTimes(1);
  });

  it("keeps the e-book reader position when switching right-pane modes", async () => {
    const source = "# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two";
    const bookTab = {
      ...activeTab,
      contents: source,
      path: "/workspace/book.md",
      id: "/workspace/book.md",
      name: "book.md",
    };
    function SidePaneHarness({ sidePaneMode }: { sidePaneMode: RightPaneMode }) {
      const [location, setLocation] = useState<{
        chapterIndex: number;
        pageIndex: number;
      } | null>(null);

      return (
        <SidePane
          {...sidePaneProps({
            activeContents: source,
            activeTab: bookTab,
            ebookLocation: location,
            onEbookLocationChange: setLocation,
            sidePaneMode,
          })}
        />
      );
    }

    const { rerender } = render(<SidePaneHarness sidePaneMode="ebook" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });

    rerender(
      <SidePaneHarness sidePaneMode="preview" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });

    rerender(
      <SidePaneHarness sidePaneMode="ebook" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
  });

  // v1.1 position-continuity pin (#4): the Preview scroll container is the
  // shared SidePane wrapper div held by `previewPaneRef`. This outer div is
  // NOT unmounted on a side-pane mode switch — only the inner leaf
  // (PreviewPane / EBookPane / DiffPane) is swapped — so the div identity and
  // its scrollTop persist across mode switches in jsdom. This pins that
  // boundary: scroll *container* ownership lives in SidePane, and a naive
  // "PreviewPane state lost scrollTop" model is wrong. The real-world
  // "Preview reopen starts at the top" symptom observed by users is therefore
  // driven by something else (e.g. the rendered HTML being replaced and the
  // scroll height collapsing, then the editor-sync path resetting scrollTop),
  // and must be reproduced separately before any fix. A future contract that
  // saves/restores scrollTop keyed by document identity belongs at the
  // SidePane / AppWorkspace level, not inside the PreviewPane leaf.
  it("keeps the shared scroll container (and its scrollTop) across a side-pane mode switch in jsdom", async () => {
    const source = "# Heading One\n\nbody\n\n# Heading Two\n\nbody";
    const bookTab = {
      ...activeTab,
      contents: source,
      path: "/workspace/book.md",
      id: "/workspace/book.md",
      name: "book.md",
    };
    const previewPaneRef = createRef<HTMLDivElement>();

    function SidePaneHarness({ sidePaneMode }: { sidePaneMode: RightPaneMode }) {
      return (
        <SidePane
          {...sidePaneProps({
            activeContents: source,
            activeTab: bookTab,
            previewPaneRef,
            sidePaneMode,
          })}
        />
      );
    }

    const { rerender } = render(<SidePaneHarness sidePaneMode="preview" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Heading One" })).toBeTruthy();
    });

    const previewContainer = previewPaneRef.current;
    expect(previewContainer).not.toBeNull();
    if (!previewContainer) {
      // Unreachable in jsdom (the ref attaches in preview mode), but
      // narrows the type for the property assignments below.
      throw new Error("preview scroll container was not attached");
    }
    Object.defineProperty(previewContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(previewContainer, "clientHeight", {
      configurable: true,
      value: 200,
    });
    previewContainer.scrollTop = 600;

    // Pin: the scroll container div identity survives a mode switch because
    // SidePane always renders this outer wrapper; only the inner leaf changes.
    const firstContainer = previewPaneRef.current;
    rerender(<SidePaneHarness sidePaneMode="ebook" />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Heading One" })).toBeTruthy();
    });

    rerender(<SidePaneHarness sidePaneMode="preview" />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Heading One" })).toBeTruthy();
    });

    // Pin: in jsdom the same div is reused, so scrollTop persists. This
    // documents the container-ownership boundary, not the user-visible
    // top-reset symptom (which needs real-layout reproduction).
    expect(previewPaneRef.current).toBe(firstContainer);
    expect(previewPaneRef.current?.scrollTop ?? 0).toBe(600);
  });

  it("shows the stale banner when the reviewed buffer changed after a tab switch", () => {
    const compared = {
      ...activeTab,
      contents: "captured",
      id: "/workspace/compared.txt",
      name: "compared.txt",
      path: "/workspace/compared.txt",
      sessionId: "session:compared",
    };
    const compareCase: Extract<CompareCase, { kind: "changes" }> = {
      kind: "changes",
      key: "review-case",
      scope: "buffer-vs-disk",
      documentPath: compared.path,
      documentLabel: compared.name,
      leftColumnLabel: "Disk",
      rightColumnLabel: "Editor",
      capturedSnapshot: captureChangeReviewSnapshot(compared),
    };

    // The active tab now differs (different session id) from the one the
    // diff was captured against, so the stale banner should render.
    const switchedTab: EditorTab = {
      ...activeTab,
      contents: "switched",
      id: "/workspace/other.txt",
      name: "other.txt",
      path: "/workspace/other.txt",
      sessionId: "session:other",
    };

    renderSidePane({
      activeContents: switchedTab.contents,
      activeTab: switchedTab,
      compareView: {
        caseKey: compareCase.key,
        lines: [],
        additions: 0,
        removals: 0,
      },
      getCompareCaseByKey: () => compareCase,
      sidePaneMode: "compare",
    });

    expect(screen.getByText("This diff is stale")).toBeTruthy();
    expect(screen.getByText("A different file became active")).toBeTruthy();
  });
});
