import { createRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSidePaneCopy } from "../../lib/locale";
import type { EditorTab } from "../../types";
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
    const { rerender } = renderSidePane({
      activeContents: source,
      activeTab: bookTab,
      sidePaneMode: "ebook",
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });

    rerender(
      <SidePane
        {...sidePaneProps({
          activeContents: source,
          activeTab: bookTab,
          sidePaneMode: "preview",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });

    rerender(
      <SidePane
        {...sidePaneProps({
          activeContents: source,
          activeTab: bookTab,
          sidePaneMode: "ebook",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
  });
});
