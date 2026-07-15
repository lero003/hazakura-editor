import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOkfReview } from "./useOkfReview";

const scanOkfBundle = vi.fn();
const cancelOkfBundleScan = vi.fn();

vi.mock("../../lib/tauri/okf", () => ({
  scanOkfBundle: (...args: unknown[]) => scanOkfBundle(...args),
  cancelOkfBundleScan: (...args: unknown[]) => cancelOkfBundleScan(...args),
}));

vi.mock("../../features/okf", async () => {
  const actual = await vi.importActual<typeof import("../../features/okf")>(
    "../../features/okf",
  );
  return {
    ...actual,
    analyzeDiscoveryResult: () => ({
      summary: {
        specLabel: "OKF v0.1 Draft",
        specVersion: "0.1",
        specCommit: "ee67a5c",
        bundleRootLabel: "/ws",
        conceptCount: 1,
        indexCount: 0,
        logCount: 0,
        unreadableCount: 0,
        failureCount: 0,
        adviceCount: 0,
        hasRootIndex: false,
        declaredOkfVersion: null,
      },
      files: [
        {
          relativePath: "a.md",
          kind: "concept",
          conceptId: "a",
          type: "Note",
          title: "A",
          okfVersion: null,
          byteLength: 10,
        },
      ],
      findings: [],
      findingsTruncated: false,
      scannedEntries: 1,
      scannedMarkdownFiles: 1,
      totalBytesRead: 10,
      truncated: false,
      cancelled: false,
      source: "disk",
    }),
  };
});

describe("useOkfReview", () => {
  beforeEach(() => {
    scanOkfBundle.mockReset();
    cancelOkfBundleScan.mockReset();
    cancelOkfBundleScan.mockResolvedValue(true);
    scanOkfBundle.mockResolvedValue({
      bundleRoot: "/ws",
      files: [],
      scannedEntries: 1,
      scannedMarkdownFiles: 1,
      totalBytesRead: 10,
      truncated: false,
      truncationReason: null,
      cancelled: false,
      source: "disk",
    });
  });

  it("requires a workspace before opening", () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "ja",
        openWorkspaceFile: vi.fn(),
        setStatus,
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openOkfReview();
    });

    expect(result.current.okfReviewVisible).toBe(false);
    expect(setStatus).toHaveBeenCalled();
    expect(scanOkfBundle).not.toHaveBeenCalled();
  });

  it("scans and stores a result for the workspace root", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "en",
        openWorkspaceFile: vi.fn(),
        setStatus,
        tabs: [],
        workspaceRootPath: "/ws",
      }),
    );

    await act(async () => {
      result.current.openOkfReview();
    });

    expect(result.current.okfReviewVisible).toBe(true);
    expect(scanOkfBundle).toHaveBeenCalledWith("/ws", "/ws");
    expect(result.current.okfReviewResult?.summary.conceptCount).toBe(1);
  });

  it("keeps the previous result when a rerun fails", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "en",
        openWorkspaceFile: vi.fn(),
        setStatus,
        tabs: [],
        workspaceRootPath: "/ws",
      }),
    );

    await act(async () => {
      result.current.openOkfReview();
    });
    expect(result.current.okfReviewResult).not.toBeNull();

    scanOkfBundle.mockRejectedValueOnce("boom");
    await act(async () => {
      result.current.rerunOkfReview();
    });

    expect(result.current.okfReviewResult?.summary.conceptCount).toBe(1);
    expect(result.current.okfReviewRerunError).toContain("boom");
  });

  it("remembers the requested root so a first failure can still rerun", async () => {
    scanOkfBundle.mockRejectedValueOnce("first fail");
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "en",
        openWorkspaceFile: vi.fn(),
        setStatus,
        tabs: [],
        workspaceRootPath: "/ws",
      }),
    );

    await act(async () => {
      result.current.openOkfReview("/ws/sub");
    });

    expect(result.current.okfBundleRoot).toBe("/ws/sub");
    expect(result.current.okfReviewError).toContain("first fail");
    expect(result.current.okfReviewResult).toBeNull();

    scanOkfBundle.mockResolvedValueOnce({
      bundleRoot: "/ws/sub",
      files: [],
      scannedEntries: 1,
      scannedMarkdownFiles: 0,
      totalBytesRead: 0,
      truncated: false,
      truncationReason: null,
      cancelled: false,
      source: "disk",
    });

    await act(async () => {
      result.current.rerunOkfReview();
    });

    expect(scanOkfBundle).toHaveBeenLastCalledWith("/ws", "/ws/sub");
    expect(result.current.okfReviewResult).not.toBeNull();
  });

  it("marks cancel as requested while a scan is in flight", async () => {
    let resolveScan: ((value: unknown) => void) | null = null;
    scanOkfBundle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "en",
        openWorkspaceFile: vi.fn(),
        setStatus: vi.fn(),
        tabs: [],
        workspaceRootPath: "/ws",
      }),
    );

    act(() => {
      result.current.openOkfReview();
    });
    expect(result.current.okfScanning).toBe(true);

    act(() => {
      result.current.requestCancelOkfReview();
    });
    expect(result.current.okfCancelRequested).toBe(true);
    expect(cancelOkfBundleScan).toHaveBeenCalled();

    await act(async () => {
      resolveScan?.({
        bundleRoot: "/ws",
        files: [],
        scannedEntries: 0,
        scannedMarkdownFiles: 0,
        totalBytesRead: 0,
        truncated: false,
        truncationReason: null,
        cancelled: true,
        source: "disk",
      });
    });
  });

  it("ignores a repeated open while the single backend scan is active", () => {
    scanOkfBundle.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() =>
      useOkfReview({
        menuLanguage: "ja",
        openWorkspaceFile: vi.fn(),
        setStatus: vi.fn(),
        tabs: [],
        workspaceRootPath: "/ws",
      }),
    );

    act(() => {
      result.current.openOkfReview();
    });
    act(() => {
      result.current.openOkfReview("/ws/other");
    });

    expect(scanOkfBundle).toHaveBeenCalledTimes(1);
    expect(result.current.okfBundleRoot).toBe("/ws");
  });

  it("closes the review and cancels an in-flight scan when the workspace changes", async () => {
    let resolveScan: ((value: unknown) => void) | null = null;
    scanOkfBundle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ workspaceRootPath }) =>
        useOkfReview({
          menuLanguage: "ja",
          openWorkspaceFile: vi.fn(),
          setStatus: vi.fn(),
          tabs: [],
          workspaceRootPath,
        }),
      { initialProps: { workspaceRootPath: "/ws" } },
    );

    act(() => {
      result.current.openOkfReview();
    });
    expect(result.current.okfReviewVisible).toBe(true);
    expect(result.current.okfScanning).toBe(true);

    rerender({ workspaceRootPath: "/other" });

    await waitFor(() => {
      expect(result.current.okfReviewVisible).toBe(false);
    });
    expect(cancelOkfBundleScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.({
        bundleRoot: "/ws",
        files: [],
        scannedEntries: 0,
        scannedMarkdownFiles: 0,
        totalBytesRead: 0,
        truncated: false,
        truncationReason: null,
        cancelled: true,
        source: "disk",
      });
    });
  });
});
