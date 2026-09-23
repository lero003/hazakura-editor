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
  appleAssistAvailabilityProbed: true,
  assistSurfaceActive: "apple-local" as const,
  consent: false,
  copy: getAgentWorkbenchCopy("en"),
  modePreference: false,
  onAssistSurfacePreferenceChange: vi.fn(),
  onConsentChange: vi.fn(),
  onModePreferenceChange: vi.fn(),
  onOpenOnDeviceModels: vi.fn(),
  onProviderChange: vi.fn(),
  onRestart: vi.fn(),
  provider: "codex" as const,
  providerLabel: "Codex CLI",
  restartPending: false,
  restartRequired: false,
  sessionLabel: "Idle",
  workspaceRootPath: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("AgentWorkbenchPreferencesPane", () => {
  it("shows Hazakura Local Assist notes when selected", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfacePreference="apple-local"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Hazakura Local Assist" }),
    ).toBeTruthy();
    expect(screen.getByText("Preview")).toBeTruthy();
    expect(
      screen.getByText(/preview writing assistance using the selected on-device model/i),
    ).toBeTruthy();
    expect(screen.getByText(/Core AI model/i)).toBeTruthy();
    expect(screen.getByText(/macOS 27 or later/i)).toBeTruthy();
    expect(screen.getByText(/Hazakura Local Assist is not available yet/)).toBeTruthy();
    expect(
      screen.queryByLabelText("Agent Workbench provider"),
    ).toBeNull();
  });

  it("allows Local Assist selection and model management while Apple Intelligence is off", () => {
    const onAssistSurfacePreferenceChange = vi.fn();
    const onOpenOnDeviceModels = vi.fn();
    const { rerender } = render(<AgentWorkbenchPreferencesPane {...baseProps}
      appleAssistAvailability={{ kind: "disabled", modelId: "apple:foundation-models:system-default" }}
      assistSurfaceActive="none" assistSurfacePreference="none"
      onAssistSurfacePreferenceChange={onAssistSurfacePreferenceChange}
      onOpenOnDeviceModels={onOpenOnDeviceModels} />);
    fireEvent.change(screen.getByLabelText("External assist"), { target: { value: "apple-local" } });
    expect(onAssistSurfacePreferenceChange).toHaveBeenCalledWith("apple-local");
    rerender(<AgentWorkbenchPreferencesPane {...baseProps}
      appleAssistAvailability={{ kind: "disabled", modelId: "apple:foundation-models:system-default" }}
      assistSurfaceActive="none" assistSurfacePreference="apple-local"
      onAssistSurfacePreferenceChange={onAssistSurfacePreferenceChange}
      onOpenOnDeviceModels={onOpenOnDeviceModels} />);
    fireEvent.click(screen.getByRole("button", { name: "Manage on-device models" }));
    expect(onOpenOnDeviceModels).toHaveBeenCalledOnce();
    expect(screen.getByTestId("apple-assist-availability-card").textContent)
      .toContain("Apple Intelligence is off");
  });

  it("does not label an inactive Local Assist surface unsupported before its first probe", () => {
    render(<AgentWorkbenchPreferencesPane {...baseProps}
      appleAssistAvailability={{ kind: "unsupported" }}
      appleAssistAvailabilityProbed={false}
      assistSurfaceActive="none" assistSurfacePreference="apple-local" />);
    const card = screen.getByTestId("apple-assist-availability-card");
    expect(card.textContent).toContain("Checked after restart");
    expect(card.textContent).not.toContain("Unsupported");
  });

  it("puts the Hazakura Local Assist availability card above the descriptive copy", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        appleAssistAvailability={{ kind: "available" }}
        assistSurfacePreference="apple-local"
      />,
    );

    const availability = screen.getByTestId("apple-assist-availability-card");
    const description = screen.getByText(/preview writing assistance using the selected on-device model/i);

    expect(availability.className).toContain(
      "preference-availability-card-available",
    );
    expect(availability.textContent).toContain("Available");
    expect(
      availability.compareDocumentPosition(description)
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(screen.queryByText(/Hazakura Local Assist is not available yet/)).toBeNull();
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

  it("hides CLI Agent but keeps Hazakura Local Assist available in the App Store distribution lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");

    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfacePreference="apple-local"
      />,
    );

    expect(screen.queryByRole("option", { name: "CLI Agent" })).toBeNull();
    expect(
      screen.getByRole("option", { name: "Hazakura Local Assist (Preview)" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "Off" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Hazakura Local Assist" }),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText("Agent Workbench provider"),
    ).toBeNull();
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
        "The assist type changes after restarting Hazakura Editor.",
      ),
    ).toBeTruthy();
  });

  it("uses preview wording in Japanese without literal experimental copy", () => {
    render(
      <AgentWorkbenchPreferencesPane
        {...baseProps}
        assistSurfacePreference="apple-local"
        copy={getAgentWorkbenchCopy("ja")}
      />,
    );

    const text = document.body.textContent ?? "";
    expect(text).toContain("Hazakura Local Assist (プレビュー)");
    expect(text).toContain("macOS 27以降");
    expect(text).toContain("Apple Silicon Mac");
    expect(text).toContain("Apple Intelligence");
    expect(text).not.toMatch(/実験的|Experimental|Alpha/);
  });
});
