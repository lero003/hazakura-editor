import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { AppleAssistAvailability } from "../../lib/tauri";

// Mock the Tauri runtime bridge. The mock is hoisted via
// vi.mock at module scope so the dynamic import in the hook
// picks it up.
const probeAppleAssistAvailability: Mock<
  () => Promise<AppleAssistAvailability>
> = vi.fn();
vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    probeAppleAssistAvailability: () => probeAppleAssistAvailability(),
  };
});

import { useAppleAssistAvailability } from "./useAppleAssistAvailability";

describe("useAppleAssistAvailability", () => {
  beforeEach(() => {
    probeAppleAssistAvailability.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in the unsupported state so the UI never flashes 'available'", () => {
    let resolveProbe: (
      value: AppleAssistAvailability | PromiseLike<AppleAssistAvailability>,
    ) => void = () => {};
    probeAppleAssistAvailability.mockImplementation(
      () =>
        new Promise<AppleAssistAvailability>((resolve) => {
          resolveProbe = resolve;
        }),
    );

    const { result } = renderHook(() => useAppleAssistAvailability());

    expect(result.current.availability).toEqual({ kind: "unsupported" });
    expect(result.current.available).toBe(false);
    // The probe has not resolved yet, so `probed` is
    // `false`. Callers (e.g. the operation-feedback panel)
    // use this to distinguish "probe in flight" from
    // "probe settled on `unsupported`".
    expect(result.current.probed).toBe(false);

    // Drain the pending promise so it does not leak.
    resolveProbe({ kind: "unsupported" });
  });

  it("reflects available once the probe resolves with available", async () => {
    probeAppleAssistAvailability.mockResolvedValue({ kind: "available" });

    const { result } = renderHook(() => useAppleAssistAvailability());

    await waitFor(() => {
      expect(result.current.availability).toEqual({ kind: "available" });
    });
    expect(result.current.available).toBe(true);
    expect(result.current.probed).toBe(true);
  });

  it("flips `probed` to true even when the probe settles on `unsupported`", async () => {
    // The Apple Local Assist operation-feedback panel
    // depends on `probed` to distinguish "probe in flight"
    // from "the environment is genuinely unsupported".
    // If the probe stays at `unsupported` (no IPC call
    // ever returned a different value), the panel still
    // wants to render an "unavailable" entry instead of
    // looking empty.
    probeAppleAssistAvailability.mockResolvedValue({ kind: "unsupported" });

    const { result } = renderHook(() => useAppleAssistAvailability());

    await waitFor(() => {
      expect(result.current.probed).toBe(true);
    });
    expect(result.current.availability).toEqual({ kind: "unsupported" });
    expect(result.current.available).toBe(false);
  });

  it("reflects each non-available state verbatim", async () => {
    const cases: AppleAssistAvailability[] = [
      { kind: "unavailable", reason: "Apple Intelligence is off" },
      { kind: "disabled" },
      { kind: "unsupported" },
    ];
    for (const expected of cases) {
      probeAppleAssistAvailability.mockResolvedValue(expected);
      const { result } = renderHook(() => useAppleAssistAvailability());
      await waitFor(() => {
        expect(result.current.availability).toEqual(expected);
      });
      expect(result.current.available).toBe(false);
    }
  });

  it("swallows probe errors as unavailable with a reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    probeAppleAssistAvailability.mockRejectedValue(new Error("ipc failed"));

    const { result } = renderHook(() => useAppleAssistAvailability());

    await waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });

    expect(result.current.availability.kind).toBe("unavailable");
    if (result.current.availability.kind === "unavailable") {
      expect(result.current.availability.reason).toContain("ipc failed");
    }
    expect(result.current.available).toBe(false);
  });
});
