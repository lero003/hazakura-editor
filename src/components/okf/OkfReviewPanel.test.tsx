import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OkfReviewResult } from "../../features/okf";
import { OkfReviewPanel } from "./OkfReviewPanel";

afterEach(() => {
  cleanup();
});

const result: OkfReviewResult = {
  summary: {
    specLabel: "OKF v0.1 Draft",
    specVersion: "0.1",
    specCommit: "ee67a5c",
    bundleRootLabel: "/ws",
    conceptCount: 1,
    indexCount: 0,
    logCount: 0,
    unreadableCount: 0,
    failureCount: 1,
    adviceCount: 1,
    hasRootIndex: false,
    declaredOkfVersion: null,
  },
  files: [
    {
      relativePath: "concepts/a.md",
      kind: "concept",
      conceptId: "a",
      type: "Note",
      title: "A",
      okfVersion: null,
      byteLength: 10,
    },
  ],
  findings: [
    {
      code: "broken-link",
      severity: "failure",
      relativePath: "concepts/a.md",
      message: "Broken internal link",
      relatedPath: "missing.md",
      sourceOffset: 12,
    },
    {
      code: "missing-optional-metadata",
      severity: "advice",
      relativePath: "concepts/a.md",
      message: "Optional metadata",
    },
  ],
  findingsTruncated: false,
  scannedEntries: 1,
  scannedMarkdownFiles: 1,
  totalBytesRead: 10,
  truncated: false,
  cancelled: false,
  source: "disk",
};

const plainManuscript: OkfReviewResult = {
  summary: {
    ...result.summary,
    conceptCount: 1,
    failureCount: 1,
    hasRootIndex: false,
    declaredOkfVersion: null,
  },
  files: [
    {
      relativePath: "draft.md",
      kind: "concept",
      conceptId: "draft",
      type: null,
      title: null,
      okfVersion: null,
      byteLength: 20,
    },
  ],
  findings: [
    {
      code: "missing-frontmatter",
      severity: "failure",
      relativePath: "draft.md",
      message: "missing",
    },
  ],
  findingsTruncated: false,
  scannedEntries: 1,
  scannedMarkdownFiles: 1,
  totalBytesRead: 20,
  truncated: false,
  cancelled: false,
  source: "disk",
};

function renderPanel(
  overrides: Partial<Parameters<typeof OkfReviewPanel>[0]> = {},
) {
  const onCancelScan = vi.fn();
  const onOpenConcept = vi.fn();
  const props: Parameters<typeof OkfReviewPanel>[0] = {
    bundleRoot: "/ws",
    cancelRequested: false,
    error: null,
    isPathDirty: () => true,
    menuLanguage: "ja",
    onCancelScan,
    onClose: vi.fn(),
    onOpenConcept,
    onRerun: vi.fn(),
    result,
    rerunError: null,
    scanning: false,
    workspaceOpen: true,
    ...overrides,
  };
  render(<OkfReviewPanel {...props} />);
  return { onCancelScan, onOpenConcept, props };
}

describe("OkfReviewPanel", () => {
  it("localizes findings and gives file-specific names to open actions", () => {
    const { onOpenConcept } = renderPanel();

    expect(screen.getByRole("heading", { name: /知識フォルダ（OKF）を点検/ })).not.toBeNull();
    expect(
      screen.getByText(/選んだフォルダが OKF v0.1 Draft として読めるかを確認/),
    ).not.toBeNull();
    expect(screen.getByText(/ディスク上の保存内容を見ます/)).not.toBeNull();
    expect(screen.getAllByText(/リンク先のファイルがない/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Broken internal link/)).toBeNull();
    expect(screen.getAllByText(/未保存のタブ/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/直した方がよいこと/)).not.toBeNull();
    expect(screen.getByText(/任意の改善案/)).not.toBeNull();

    expect(screen.getByRole("heading", { name: "まずここを直す" })).not.toBeNull();
    expect(
      screen.getByText(/開いて修正し、保存してから再点検/),
    ).not.toBeNull();

    const openButtons = screen.getAllByRole("button", {
      name: /開いて修正: concepts\/a\.md/,
    });
    // First-fix card + list row for the same finding.
    expect(openButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(openButtons[0]);
    expect(onOpenConcept).toHaveBeenCalledWith("concepts/a.md", 12);
  });

  it("frames ordinary manuscript folders as normal writing", () => {
    renderPanel({ result: plainManuscript });
    expect(screen.getByText(/通常の原稿フォルダです/)).not.toBeNull();
    expect(screen.getByText(/準備項目が 1 件/)).not.toBeNull();
    expect(screen.getByText(/OKF として整える準備/)).not.toBeNull();
    expect(screen.queryByText(/直した方がよいこと/)).toBeNull();
    // Conversion prep must not re-use the hard-failure severity badge.
    expect(screen.getByText("準備")).not.toBeNull();
    expect(
      screen.queryByText((content, element) => {
        return (
          element?.classList.contains("okf-review-kind") === true &&
          content === "直した方がよい"
        );
      }),
    ).toBeNull();
  });

  it("keeps raw counts under a details disclosure", () => {
    renderPanel();
    expect(screen.getByText("詳細（仕様・件数）")).not.toBeNull();
    expect(screen.getByText("ファイルと参考情報")).not.toBeNull();
    expect(
      screen.getByText((content, element) => {
        return (
          element?.classList.contains("okf-review-spec") === true &&
          content.includes("ee67a5c")
        );
      }),
    ).not.toBeNull();
    expect(screen.getAllByText("ノート").length).toBeGreaterThanOrEqual(1);
  });

  it("supports cancellation and announces bounded findings", () => {
    const { onCancelScan } = renderPanel({
      result: { ...result, findingsTruncated: true },
      scanning: true,
    });

    expect(screen.getByText(/表示上限/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "中止" }));
    expect(onCancelScan).toHaveBeenCalledTimes(1);
  });
});
