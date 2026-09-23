import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { AppleAssistAvailability } from "../../lib/tauri";

// Mock the Tauri runtime bridge. The mock is hoisted via
// vi.mock at module scope so the dynamic import in the hook
// picks it up.
const probeAppleAssistAvailability: Mock<
  () => Promise<AppleAssistAvailability>
> = vi.fn();
const modelEvents = vi.hoisted(() => ({
  listener: null as null | ((catalog: import("../../lib/tauri/coreAiModels").CoreAiModelCatalog) => void),
}));
vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    probeAppleAssistAvailability: () => probeAppleAssistAvailability(),
  };
});
vi.mock("../../lib/tauri/coreAiModels", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri/coreAiModels")>("../../lib/tauri/coreAiModels");
  return {
    ...actual,
    listenCoreAiModelStateChanges: vi.fn(async (listener: typeof modelEvents.listener) => {
      modelEvents.listener = listener;
      return () => { modelEvents.listener = null; };
    }),
  };
});

import { useAppleAssistAvailability } from "./useAppleAssistAvailability";

describe("useAppleAssistAvailability", () => {
  beforeEach(() => {
    probeAppleAssistAvailability.mockReset();
    modelEvents.listener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("does not invent a disabled state before an explicit probe and retains the last result", async () => {
    probeAppleAssistAvailability.mockResolvedValue({ kind: "available" });

    const { result, rerender } = renderHook(
      ({ enabled }) => useAppleAssistAvailability(enabled),
      { initialProps: { enabled: false } },
    );

    expect(probeAppleAssistAvailability).not.toHaveBeenCalled();
    expect(result.current.availability).toEqual({ kind: "unsupported" });
    expect(result.current.probed).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current.availability).toEqual({ kind: "available" });
    });
    expect(result.current.probed).toBe(true);

    rerender({ enabled: false });
    expect(result.current.availability).toEqual({ kind: "available" });
    expect(result.current.probed).toBe(true);
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

  it("recovers from Apple Intelligence off when a selected downloaded model probes ready", async () => {
    probeAppleAssistAvailability
      .mockResolvedValueOnce({ kind: "disabled", modelId: "apple:foundation-models:system-default" })
      .mockResolvedValueOnce({ kind: "available", modelId: "apple:core-ai:gemma4-12b" });
    const { result } = renderHook(() => useAppleAssistAvailability());
    await waitFor(() => expect(result.current.availability.kind).toBe("disabled"));
    await waitFor(() => expect(modelEvents.listener).not.toBeNull());

    await act(async () => modelEvents.listener?.({
      distributionStatus: "available",
      selectedModelId: "apple:core-ai:gemma4-12b",
      models: [{
        id: "apple:core-ai:gemma4-12b", displayName: "Gemma 4 12B", kind: "core_ai",
        source: "apple_hosted", status: "ready", selected: true,
      }],
    }));
    await waitFor(() => expect(result.current.availability).toEqual({
      kind: "available", modelId: "apple:core-ai:gemma4-12b",
    }));
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(2);

    probeAppleAssistAvailability.mockResolvedValueOnce({
      kind: "disabled", modelId: "apple:foundation-models:system-default",
    });
    await act(async () => modelEvents.listener?.({
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [{
        id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
        kind: "system", status: "ready", selected: true,
      }],
    }));
    await waitFor(() => expect(result.current.availability).toEqual({
      kind: "disabled", modelId: "apple:foundation-models:system-default",
    }));
  });

  it("does not re-probe the disabled System model for unrelated download progress", async () => {
    probeAppleAssistAvailability.mockResolvedValue({
      kind: "disabled", modelId: "apple:foundation-models:system-default",
    });
    const { result } = renderHook(() => useAppleAssistAvailability());
    await waitFor(() => expect(result.current.probed).toBe(true));
    await waitFor(() => expect(modelEvents.listener).not.toBeNull());
    const catalog = {
      distributionStatus: "available" as const,
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system" as const, status: "ready" as const, selected: true },
        { id: "apple:core-ai:gemma4-12b", displayName: "Gemma 4 12B", kind: "core_ai" as const, status: "downloading" as const, selected: false, progress: 0.1 },
      ],
    };
    await act(async () => modelEvents.listener?.(catalog));
    await act(async () => modelEvents.listener?.({ ...catalog, models: [catalog.models[0], { ...catalog.models[1], progress: 0.8 }] }));
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(1);
  });

  it("does not retain old-model availability while a changed model is being probed", async () => {
    probeAppleAssistAvailability.mockResolvedValueOnce({ kind: "available", modelId: "old-model" });
    const { result, rerender } = renderHook(
      ({ refreshKey }) => useAppleAssistAvailability(true, refreshKey),
      { initialProps: { refreshKey: 0 } },
    );
    await waitFor(() => expect(result.current.available).toBe(true));
    let resolve!: (value: AppleAssistAvailability) => void;
    probeAppleAssistAvailability.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    rerender({ refreshKey: 1 });
    expect(result.current.probed).toBe(false);
    expect(result.current.available).toBe(false);
    expect(result.current.availability.modelId).toBeUndefined();
    await act(async () => { resolve({ kind: "unavailable", modelId: "new-model", reason: "missing" }); });
    expect(result.current.probed).toBe(true);
    expect(result.current.availability.modelId).toBe("new-model");
  });

  it("flips `probed` to true even when the probe settles on `unsupported`", async () => {
    // The Hazakura Local Assist operation-feedback panel
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

  it("retries a transient native busy probe before reporting unavailable", async () => {
    vi.useFakeTimers();
    probeAppleAssistAvailability
      .mockRejectedValueOnce(new Error("Local Assist is busy. Check availability again after the current operation finishes."))
      .mockResolvedValueOnce({ kind: "available", modelId: "local:external:e4b" });

    const { result } = renderHook(() => useAppleAssistAvailability());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.probed).toBe(false);
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(2);
    expect(result.current.availability).toEqual({ kind: "available", modelId: "local:external:e4b" });
    expect(result.current.probed).toBe(true);
  });

  it("stops retrying a busy probe when its screen unmounts", async () => {
    vi.useFakeTimers();
    probeAppleAssistAvailability.mockRejectedValue(
      new Error("Local Assist is busy. Check availability again after the current operation finishes."),
    );
    const { unmount } = renderHook(() => useAppleAssistAvailability());
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(1);
  });

  it("recovers without reselection when an earlier model probe finishes after 20 seconds", async () => {
    vi.useFakeTimers();
    let firstProbeStillLoading = true;
    probeAppleAssistAvailability.mockImplementation(() => firstProbeStillLoading
      ? Promise.reject(new Error("Local Assist is busy. Check availability again after the current operation finishes."))
      : Promise.resolve({ kind: "available", modelId: "local:external:e4b" }));
    setTimeout(() => { firstProbeStillLoading = false; }, 20_000);

    const { result } = renderHook(() => useAppleAssistAvailability());
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    expect(result.current.probed).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(result.current.availability).toEqual({ kind: "available", modelId: "local:external:e4b" });
    expect(result.current.probed).toBe(true);
  });

  it("stops the old model's busy retries when the selected model changes", async () => {
    vi.useFakeTimers();
    probeAppleAssistAvailability
      .mockRejectedValueOnce(new Error("Local Assist is busy. Check availability again after the current operation finishes."))
      .mockResolvedValue({ kind: "available", modelId: "local:new-model" });
    const { result, rerender } = renderHook(
      ({ refreshKey }) => useAppleAssistAvailability(true, refreshKey),
      { initialProps: { refreshKey: 0 } },
    );
    await act(async () => { await Promise.resolve(); });
    rerender({ refreshKey: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(2);
    expect(result.current.availability).toEqual({ kind: "available", modelId: "local:new-model" });
  });

  it("keeps retrying a sustained busy probe until the overall deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    probeAppleAssistAvailability.mockRejectedValue(
      new Error("Local Assist is busy. Check availability again after the current operation finishes."),
    );
    const { result } = renderHook(() => useAppleAssistAvailability());
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    expect(probeAppleAssistAvailability).toHaveBeenCalledTimes(6);
    expect(result.current.probed).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(result.current.probed).toBe(true);
    expect(result.current.availability.kind).toBe("unavailable");
    expect(probeAppleAssistAvailability.mock.calls.length).toBeGreaterThan(6);
  });

  it("allows the eager Core AI model probe to use its native timeout budget", async () => {
    vi.useFakeTimers();
    probeAppleAssistAvailability.mockImplementation(
      () => new Promise<AppleAssistAvailability>(() => {}),
    );

    const { result } = renderHook(() => useAppleAssistAvailability());

    expect(result.current.probed).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });

    expect(result.current.probed).toBe(true);
    expect(result.current.availability.kind).toBe("unavailable");
    if (result.current.availability.kind === "unavailable") {
      expect(result.current.availability.reason).toContain("timed out");
    }
  });
});
