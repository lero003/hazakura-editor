import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAgentWorkbenchController } from "./useAgentWorkbenchController";

describe("useAgentWorkbenchController", () => {
  it("returns the agent workbench action surface", () => {
    const { result } = renderHook(() =>
      useAgentWorkbenchController({
        activeAgentSession: false,
        agentSession: null,
        agentTerminalSize: null,
        agentWorkbenchActive: false,
        agentWorkbenchConsent: false,
        agentWorkbenchProvider: "claude",
        applyAgentOutput: vi.fn(),
        closeWorkspaceContextMenu: vi.fn(),
        editorPaneRef: { current: null },
        menuLanguage: "en",
        setAgentLaunchGate: vi.fn(),
        setAgentSession: vi.fn(),
        setAgentStopPending: vi.fn(),
        setAgentTerminalSize: vi.fn(),
        setAgentWorkbenchConsent: vi.fn(),
        setAgentWorkbenchPreference: vi.fn(),
        setAgentWorkbenchProvider: vi.fn(),
        setAppRestartPending: vi.fn(),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: null,
      }),
    );

    // preference actions (4)
    expect(result.current).toHaveProperty("restartAppForAgentMode");
    expect(result.current).toHaveProperty("updateAgentWorkbenchConsent");
    expect(result.current).toHaveProperty("updateAgentWorkbenchPreference");
    expect(result.current).toHaveProperty("updateAgentWorkbenchProvider");
    // session actions (4)
    expect(result.current).toHaveProperty("refreshAgentSessionState");
    expect(result.current).toHaveProperty("requestAgentLaunchGateCheck");
    expect(result.current).toHaveProperty("requestAgentSessionStop");
    expect(result.current).toHaveProperty("sendWorkspacePathToAgent");
    // terminal actions (4)
    expect(result.current).toHaveProperty("handlePresetPrompt");
    expect(result.current).toHaveProperty("handleSendSelectionToAgent");
    expect(result.current).toHaveProperty("resizeAgentTerminal");
    expect(result.current).toHaveProperty("sendAgentTerminalData");
  });
});
