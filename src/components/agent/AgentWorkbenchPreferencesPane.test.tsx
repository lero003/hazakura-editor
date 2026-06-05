import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  cleanup,
} from "@testing-library/react";
import { AgentWorkbenchPreferencesPane } from "./AgentWorkbenchPreferencesPane";
import { getAgentWorkbenchCopy } from "../../lib/locale";

const baseProps = {
  active: false,
  activeSession: false,
  appleAssistAvailability: {
    kind: "unavailable",
    reason: "Foundation Models binding is not yet implemented in this build.",
  } as const,
  assistSurfaceActive: "apple-local" as const,
  consent: false,
  copy: getAgentWorkbenchCopy("en"),
  modePreference: false,
  onAssistSurfacePreferenceChange: vi.fn(),
  onConsentChange: vi.fn(),
  onModePreferenceChange: vi.fn(),
  onProviderChange: vi.fn(),
  onRestart: vi.fn(),
  provider: "codex" as const,
  providerLabel: "Codex CLI",
  restartPending: false,
  restartRequired: false,
  sessionLabel: "Idle",
  workspaceRootPath: null,
};

afterEach(cleanup);

describe("AgentWorkbenchPreferencesPane", () => {
  it("shows Apple Assist notes when Apple Local Assist is selected", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfacePreference="apple-local"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Apple Assist" }),
    ).toBeTruthy();
    expect(screen.getByText(/Apple Local Assist is not available yet/)).toBeTruthy();
    expect(
      screen.queryByLabelText("Agent Workbench provider"),
    ).toBeNull();
  });

  it("shows CLI Agent settings only when the CLI surface is selected", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        active
        modePreference
        assistSurfacePreference="external-cli"
      />,
    );

    expect(screen.getByLabelText("Agent Workbench provider")).toBeTruthy();
    expect(
      screen.getByText(
        "I understand the Agent Workbench responsibility boundary.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Apple Local Assist is not available yet/)).toBeNull();
  });

  it("emits assist surface preference changes from the selector", () => {
    const onAssistSurfacePreferenceChange = vi.fn();
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfacePreference="apple-local"
        onAssistSurfacePreferenceChange={onAssistSurfacePreferenceChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("External assist"), {
      target: { value: "external-cli" },
    });

    expect(onAssistSurfacePreferenceChange).toHaveBeenCalledWith(
      "external-cli",
    );
  });

  it("shows restart warning when the assist surface preference differs from the active surface", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfaceActive="apple-local"
        assistSurfacePreference="none"
      />,
    );

    expect(
      screen.getByText(
        "The assist type changes after restarting hazakura editor.",
      ),
    ).toBeTruthy();
  });
});
