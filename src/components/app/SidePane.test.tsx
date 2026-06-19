import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
  render(
    <SidePane
      activeContents={activeTab.contents}
      activeTab={activeTab}
      compareSource={null}
      compareTarget={null}
      compareView={null}
      copy={getSidePaneCopy("en")}
      currentHeadingLine={null}
      documentHeadings={[]}
      getCompareCaseByKey={() => undefined}
      menuLanguage="en"
      onApplyBackup={vi.fn()}
      onClearCompareSource={vi.fn()}
      onClearCompareTarget={vi.fn()}
      onCloseCompareView={vi.fn()}
      onOpenPreviewLocalLink={vi.fn()}
      onPreviewScroll={vi.fn()}
      onRunSelectedFileCompare={vi.fn()}
      onSelectHeading={vi.fn()}
      outlineTruncated={false}
      previewPaneRef={createRef<HTMLDivElement>()}
      previewVisible
      sidePaneMode="ebook"
      workspaceRootPath="/workspace"
      {...overrides}
    />,
  );
}

describe("SidePane", () => {
  it("shows a clear empty state for e-book mode when preview content is unavailable", () => {
    renderSidePane({ previewVisible: false });

    expect(screen.getByLabelText("Read as a book (e-book)")).toBeTruthy();
    expect(
      screen.getByText("Preview pane is disabled in Preferences."),
    ).toBeTruthy();
  });
});
