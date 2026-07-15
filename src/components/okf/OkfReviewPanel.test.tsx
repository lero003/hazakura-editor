import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OkfReviewResult } from "../../features/okf";
import { OkfReviewPanel } from "./OkfReviewPanel";

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
    adviceCount: 0,
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
  return { onCancelScan, onOpenConcept };
}

describe("OkfReviewPanel", () => {
  it("localizes findings and gives file-specific names to open actions", () => {
    const { onOpenConcept } = renderPanel();

    expect(screen.getByText(/リンク先がない/)).not.toBeNull();
    expect(screen.queryByText(/Broken internal link/)).toBeNull();
    expect(screen.getByText(/未保存のタブ/)).not.toBeNull();

    const openButtons = screen.getAllByRole("button", {
      name: /concepts\/a\.md/,
    });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);
    expect(onOpenConcept).toHaveBeenCalledWith("concepts/a.md");
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
