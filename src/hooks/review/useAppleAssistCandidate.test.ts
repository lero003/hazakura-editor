import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { AppleAssistResponse, AppleAssistOperation } from "../../lib/tauri";

// Mock the Tauri runtime bridge.
const generateAppleAssistCandidate: Mock<
  (request: {
    operation: AppleAssistOperation;
    selectedText: string;
    documentContext?: string;
  }) => Promise<AppleAssistResponse>
> = vi.fn();
vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    generateAppleAssistCandidate: (request: unknown) =>
      generateAppleAssistCandidate(request as never),
  };
});

import { useAppleAssistCandidate, type AppleAssistTarget } from "./useAppleAssistCandidate";

const target: AppleAssistTarget = {
  id: "tab-1",
  name: "notes.md",
  path: "/tmp/notes.md",
  contents: "the quick brown fox\njumps over the lazy dog\n",
};

const copy = {
  candidateColumnLeft: "Current buffer",
  candidateColumnRight: "Candidate",
  candidateSourceAppleAssist: "Apple Local Assist (on-device)",
} as unknown as Parameters<typeof useAppleAssistCandidate>[0]["copy"];

function makeRunCandidateCompare(impl?: (params: never) => { ok: true } | { ok: false; error: string }) {
  return vi.fn(
    impl ??
      (() => ({ ok: true as const })),
  ) as unknown as Parameters<typeof useAppleAssistCandidate>[0]["runCandidateCompare"];
}

describe("useAppleAssistCandidate", () => {
  beforeEach(() => {
    generateAppleAssistCandidate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when there is no active tab", async () => {
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: null,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.generateAndCompare("summarize", "hello");
    });

    expect(returned.ok).toBe(false);
    expect(result.current.error).toMatch(/active editor tab/);
    expect(generateAppleAssistCandidate).not.toHaveBeenCalled();
  });

  it("rejects when the selection is empty", async () => {
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.generateAndCompare("summarize", "");
    });

    expect(returned.ok).toBe(false);
    expect(result.current.error).toMatch(/empty/);
    expect(generateAppleAssistCandidate).not.toHaveBeenCalled();
  });

  it("rejects operations that are deferred in v0.12", async () => {
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.generateAndCompare("extract", "hello");
    });

    expect(returned.ok).toBe(false);
    expect(result.current.error).toContain("not implemented in v0.12");
    expect(generateAppleAssistCandidate).not.toHaveBeenCalled();
  });

  it("calls generate then runCandidateCompare with the Apple Local source label", async () => {
    generateAppleAssistCandidate.mockResolvedValue({
      operation: "summarize",
      candidateText: "【要約案】\nbody",
      modelId: "stub:v0.12",
      latencyMs: 0,
    });

    const runCandidateCompare = makeRunCandidateCompare();
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare,
      }),
    );

    let returned: { ok: boolean } = { ok: false };
    await act(async () => {
      returned = (await result.current.generateAndCompare(
        "summarize",
        "body",
      )) as { ok: boolean };
    });

    expect(returned.ok).toBe(true);
    expect(generateAppleAssistCandidate).toHaveBeenCalledWith({
      operation: "summarize",
      selectedText: "body",
    });
    expect(runCandidateCompare).toHaveBeenCalledTimes(1);
    const params = (runCandidateCompare as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(params).toMatchObject({
      bufferContents: target.contents,
      documentTabId: target.id,
      documentPath: target.path,
      documentLabel: target.name,
      leftColumnLabel: copy.candidateColumnLeft,
      rightColumnLabel: copy.candidateColumnRight,
      candidateSourceLabel: copy.candidateSourceAppleAssist,
      candidateText: "【要約案】\nbody",
    });
  });

  it("surfaces runCandidateCompare errors via the same ok/error shape", async () => {
    generateAppleAssistCandidate.mockResolvedValue({
      operation: "rephrase",
      candidateText: "【書き換え案】\nbody",
      modelId: "stub:v0.12",
      latencyMs: 0,
    });

    const runCandidateCompare = makeRunCandidateCompare(() => ({
      ok: false,
      error: "buffer / candidate combination is too large",
    }));

    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare,
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.generateAndCompare("rephrase", "body");
    });

    expect(returned.ok).toBe(false);
    expect(returned.error).toContain("too large");
    expect(result.current.error).toContain("too large");
  });

  it("surfaces generate errors without auto-applying anything", async () => {
    generateAppleAssistCandidate.mockRejectedValue(new Error("ipc failed"));

    const runCandidateCompare = makeRunCandidateCompare();
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare,
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.generateAndCompare("summarize", "body");
    });

    expect(returned.ok).toBe(false);
    expect(returned.error).toContain("ipc failed");
    expect(runCandidateCompare).not.toHaveBeenCalled();
    expect(result.current.error).toContain("ipc failed");
  });

  it("toggles busy while a request is in flight", async () => {
    let resolveGenerate: (value: AppleAssistResponse) => void = () => {};
    generateAppleAssistCandidate.mockImplementation(
      () =>
        new Promise<AppleAssistResponse>((resolve) => {
          resolveGenerate = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: target,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
      }),
    );

    expect(result.current.busy).toBe(false);

    let inFlight: Promise<unknown> = Promise.resolve();
    act(() => {
      inFlight = result.current.generateAndCompare("summarize", "body");
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveGenerate({
        operation: "summarize",
        candidateText: "x",
        modelId: "stub:v0.12",
        latencyMs: 0,
      });
      await inFlight;
    });
    expect(result.current.busy).toBe(false);
  });

  it("clearError resets the error slot", async () => {
    const { result } = renderHook(() =>
      useAppleAssistCandidate({
        activeTab: null,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
      }),
    );

    await act(async () => {
      await result.current.generateAndCompare("summarize", "body");
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
