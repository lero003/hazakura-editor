import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
  AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
  AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
} from "../../types";
import { useAgentWorkbenchPreferences } from "./useAgentWorkbenchPreferences";

describe("useAgentWorkbenchPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns Safe Editor defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    expect(result.current.agentWorkbenchActive).toBe(false);
    expect(result.current.agentWorkbenchPreference).toBe(false);
    expect(result.current.agentWorkbenchConsent).toBe(false);
    expect(result.current.agentWorkbenchProvider).toBe("codex");
    expect(result.current.agentWorkbenchAvailable).toBe(false);
  });

  it("reads enabled / consent / provider from localStorage on mount", () => {
    window.localStorage.setItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY, "true");
    window.localStorage.setItem(AGENT_WORKBENCH_CONSENT_STORAGE_KEY, "true");
    window.localStorage.setItem(AGENT_WORKBENCH_PROVIDER_STORAGE_KEY, "pi");

    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    expect(result.current.agentWorkbenchActive).toBe(true);
    expect(result.current.agentWorkbenchPreference).toBe(true);
    expect(result.current.agentWorkbenchConsent).toBe(true);
    expect(result.current.agentWorkbenchProvider).toBe("pi");
    expect(result.current.agentWorkbenchAvailable).toBe(true);
  });

  it("treats agentWorkbenchActive as frozen at mount even after preference flips", () => {
    window.localStorage.setItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY, "false");

    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    expect(result.current.agentWorkbenchActive).toBe(false);

    act(() => {
      result.current.setAgentWorkbenchPreference(true);
    });

    expect(result.current.agentWorkbenchPreference).toBe(true);
    expect(result.current.agentWorkbenchActive).toBe(false);
  });

  it("persists preference / consent / provider changes to localStorage", () => {
    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    act(() => {
      result.current.setAgentWorkbenchPreference(true);
      result.current.setAgentWorkbenchConsent(true);
      result.current.setAgentWorkbenchProvider("opencode");
    });

    expect(
      window.localStorage.getItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY),
    ).toBe("true");
    expect(
      window.localStorage.getItem(AGENT_WORKBENCH_CONSENT_STORAGE_KEY),
    ).toBe("true");
    expect(
      window.localStorage.getItem(AGENT_WORKBENCH_PROVIDER_STORAGE_KEY),
    ).toBe("opencode");
  });

  it("accepts the allowlisted providers (codex / opencode / pi / claude)", () => {
    for (const provider of ["codex", "opencode", "pi", "claude"] as const) {
      window.localStorage.setItem(AGENT_WORKBENCH_PROVIDER_STORAGE_KEY, provider);
      const { result, unmount } = renderHook(() =>
        useAgentWorkbenchPreferences(),
      );
      expect(result.current.agentWorkbenchProvider).toBe(provider);
      unmount();
    }
  });

  it("falls back to codex when the stored provider is not allowlisted", () => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
      "some-unapproved-provider",
    );

    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    expect(result.current.agentWorkbenchProvider).toBe("codex");
  });

  it("derives agentWorkbenchAvailable as active && consent", () => {
    window.localStorage.setItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY, "true");
    window.localStorage.setItem(AGENT_WORKBENCH_CONSENT_STORAGE_KEY, "false");

    const { result } = renderHook(() => useAgentWorkbenchPreferences());

    expect(result.current.agentWorkbenchActive).toBe(true);
    expect(result.current.agentWorkbenchConsent).toBe(false);
    expect(result.current.agentWorkbenchAvailable).toBe(false);

    act(() => {
      result.current.setAgentWorkbenchConsent(true);
    });

    expect(result.current.agentWorkbenchAvailable).toBe(true);
  });
});
