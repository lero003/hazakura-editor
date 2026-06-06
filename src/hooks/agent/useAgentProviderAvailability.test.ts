import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { AgentProviderAvailability } from "../../lib/tauri";

// Mock the Tauri runtime bridge so the hook does not actually
// touch IPC. The mock is hoisted via vi.mock at module scope so
// the import in the hook picks it up. The Mock type parameter
// keeps `mockResolvedValue` and `mockImplementation` properly typed
// so the Promise resolver inside the test body is also typed.
const listAgentProviderAvailability: Mock<
  () => Promise<AgentProviderAvailability[]>
> = vi.fn();
vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    listAgentProviderAvailability: () => listAgentProviderAvailability(),
  };
});

import { useAgentProviderAvailability } from "./useAgentProviderAvailability";

const fixture: AgentProviderAvailability[] = [
  { provider: "codex", available: true, path: "/usr/local/bin/codex" },
  { provider: "opencode", available: false, path: "" },
  { provider: "pi", available: false, path: "" },
  { provider: "claude", available: true, path: "/opt/homebrew/bin/claude" },
];

describe("useAgentProviderAvailability", () => {
  beforeEach(() => {
    listAgentProviderAvailability.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with an empty snapshot before the fetch resolves", () => {
    // Capture the Promise resolver so we can drain the pending
    // fetch at the end of the test. The closure-based assignment
    // defeats TypeScript's control-flow narrowing on the post-call
    // site, so a noop initializer (matched to the real resolver
    // signature) keeps the `let` callable without an `as` cast.
    let resolveFetch: (
      value:
        | AgentProviderAvailability[]
        | PromiseLike<AgentProviderAvailability[]>,
    ) => void = () => {};
    listAgentProviderAvailability.mockImplementation(
      () =>
        new Promise<AgentProviderAvailability[]>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() => useAgentProviderAvailability());

    expect(result.current.availability).toEqual([]);
    expect(result.current.availabilityByProvider.size).toBe(0);

    // Drain the pending promise so it does not leak into the next
    // test.
    resolveFetch([]);
  });

  it("populates availability and the lookup map once the fetch resolves", async () => {
    listAgentProviderAvailability.mockResolvedValue(fixture);

    const { result } = renderHook(() => useAgentProviderAvailability());

    await waitFor(() => {
      expect(result.current.availability).toEqual(fixture);
    });

    expect(result.current.availabilityByProvider.get("codex")?.available).toBe(
      true,
    );
    expect(
      result.current.availabilityByProvider.get("opencode")?.available,
    ).toBe(false);
    expect(
      result.current.availabilityByProvider.get("not-a-real-provider"),
    ).toBeUndefined();
  });

  it("swallows fetch errors and leaves the snapshot empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    listAgentProviderAvailability.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useAgentProviderAvailability());

    await waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });

    expect(result.current.availability).toEqual([]);
    expect(result.current.availabilityByProvider.size).toBe(0);
  });

  it("does not fetch provider availability when disabled", () => {
    const { result } = renderHook(() => useAgentProviderAvailability(false));

    expect(listAgentProviderAvailability).not.toHaveBeenCalled();
    expect(result.current.availability).toEqual([]);
    expect(result.current.availabilityByProvider.size).toBe(0);
  });
});
