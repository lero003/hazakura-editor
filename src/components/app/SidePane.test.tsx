import { createRef, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSidePaneCopy } from "../../lib/locale";
import type { EditorTab, RightPaneMode } from "../../types";
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
    documentHeadings: [],
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
    onRunSelectedFileCompare: vi.fn(),
    onSelectHeading: vi.fn(),
    outlineTruncated: false,
    previewPaneRef: createRef<HTMLDivElement>(),
    previewVisible: true,
    sidePaneMode: "ebook",
    workspaceRootPath: "/workspace",
    ...overrides,
  };
}

describe("SidePane", () => {
  it("shows a clear empty state for e-book mode when preview content is unavailable", () => {
    renderSidePane({ previewVisible: false });

    expect(screen.getByLabelText("Read as a book (e-book)")).toBeTruthy();
    expect(
      screen.getByText("Preview pane is disabled in Preferences."),
    ).toBeTruthy();
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
});
