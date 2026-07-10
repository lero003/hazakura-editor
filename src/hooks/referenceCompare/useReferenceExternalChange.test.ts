import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReferenceFileMetadata } from "../../lib/tauri";
import { useReferenceExternalChange } from "./useReferenceExternalChange";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    getReferenceFileMetadata: vi.fn(),
  };
});

const baseState = (
  overrides: Partial<ReferenceCompareState> = {},
): ReferenceCompareState => ({
  reference: {
    kind: "pdf",
    path: "/ws/scan.pdf",
    name: "scan.pdf",
    pageCount: 2,
    referenceId: "pdf-ref-1",
  },
  origin: "manual",
  linkedEditorSessionId: null,
  followMode: "off",
  sourceFingerprint: "fp-1",
  externalChangePending: false,
  ...overrides,
});

describe("useReferenceExternalChange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getReferenceFileMetadata).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies when the disk fingerprint changes", async () => {
    vi.mocked(getReferenceFileMetadata).mockResolvedValue({
      path: "/ws/scan.pdf",
      size: 10,
      modified_ms: 2,
      fingerprint: "fp-changed",
      large_file_warning: false,
    });
    const onExternalChange = vi.fn();

    renderHook(() =>
      useReferenceExternalChange({
        referenceCompare: baseState(),
        onExternalChange,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onExternalChange).toHaveBeenCalledTimes(1);
  });

  it("notifies when the reference file is missing or unreadable", async () => {
    vi.mocked(getReferenceFileMetadata).mockRejectedValue(
      new Error("Cannot read file: No such file"),
    );
    const onExternalChange = vi.fn();

    renderHook(() =>
      useReferenceExternalChange({
        referenceCompare: baseState(),
        onExternalChange,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onExternalChange).toHaveBeenCalledTimes(1);
  });

  it("does not poll when a change is already pending", async () => {
    const onExternalChange = vi.fn();
    renderHook(() =>
      useReferenceExternalChange({
        referenceCompare: baseState({ externalChangePending: true }),
        onExternalChange,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(getReferenceFileMetadata).not.toHaveBeenCalled();
    expect(onExternalChange).not.toHaveBeenCalled();
  });

  it("polls on interval while fingerprint is stable", async () => {
    vi.mocked(getReferenceFileMetadata).mockResolvedValue({
      path: "/ws/scan.pdf",
      size: 10,
      modified_ms: 1,
      fingerprint: "fp-1",
      large_file_warning: false,
    });
    const onExternalChange = vi.fn();

    renderHook(() =>
      useReferenceExternalChange({
        referenceCompare: baseState(),
        onExternalChange,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(getReferenceFileMetadata).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(getReferenceFileMetadata).toHaveBeenCalledTimes(2);
    expect(onExternalChange).not.toHaveBeenCalled();
  });
});
