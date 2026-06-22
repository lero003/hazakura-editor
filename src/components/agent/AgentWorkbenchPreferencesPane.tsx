import type { AgentWorkbenchCopy } from "../../lib/locale";
import type {
  AgentWorkbenchProvider,
  AppleAssistAvailability,
} from "../../lib/tauri";
import { useAgentProviderAvailability } from "../../hooks/agent/useAgentProviderAvailability";
import {
  isAppleLocalAssistSurfaceAllowed,
  isExternalCliAssistSurfaceAllowed,
} from "../../lib/distributionLane";
import {
  AGENT_WORKBENCH_PROVIDERS,
  type AssistSurfacePreference,
} from "../../types";

type AgentWorkbenchPreferencesPaneProps = {
  active: boolean;
  activeSession: boolean;
  appleAssistAvailability: AppleAssistAvailability;
  assistSurfaceActive: AssistSurfacePreference;
  assistSurfacePreference: AssistSurfacePreference;
  consent: boolean;
  copy: AgentWorkbenchCopy;
  modePreference: boolean;
  onAssistSurfacePreferenceChange: (surface: AssistSurfacePreference) => void;
  onConsentChange: (enabled: boolean) => void;
  onModePreferenceChange: (enabled: boolean) => void;
  onProviderChange: (provider: AgentWorkbenchProvider) => void;
  onRestart: () => void;
  provider: AgentWorkbenchProvider;
  providerLabel: string;
  restartPending: boolean;
  restartRequired: boolean;
  sessionLabel: string;
  workspaceRootPath: string | null;
};

export function AgentWorkbenchPreferencesPane({
  active,
  activeSession,
  appleAssistAvailability,
  assistSurfaceActive,
  assistSurfacePreference,
  consent,
  copy,
  modePreference,
  onAssistSurfacePreferenceChange,
  onConsentChange,
  onModePreferenceChange,
  onProviderChange,
  onRestart,
  provider,
  providerLabel,
  restartPending,
  restartRequired,
  sessionLabel,
  workspaceRootPath,
}: AgentWorkbenchPreferencesPaneProps) {
  const externalCliAllowed = isExternalCliAssistSurfaceAllowed();
  const appleLocalAssistAllowed = isAppleLocalAssistSurfaceAllowed();
  const { availabilityByProvider } =
    useAgentProviderAvailability(externalCliAllowed);
  const currentAvailability = availabilityByProvider.get(provider);
  const currentProviderUnavailable =
    currentAvailability !== undefined && !currentAvailability.available;
  const showAppleSettings =
    appleLocalAssistAllowed && assistSurfacePreference === "apple-local";
  const showCliSettings =
    externalCliAllowed && assistSurfacePreference === "external-cli";
  const assistSurfaceRestartRequired =
    assistSurfaceActive !== assistSurfacePreference;
  const appleAvailabilityPresentation = getAppleAssistAvailabilityPresentation(
    copy,
    appleAssistAvailability,
  );

  return (
    <div className="agent-workbench-settings">
      <section
        aria-label={copy.surfaceSectionLabel}
        className="preference-section"
      >
        <h3>{copy.surfaceHeading}</h3>
        <label className="field-control">
          <span>{copy.assistSurfaceControl}</span>
          <select
            aria-label={copy.assistSurfaceControl}
            disabled={activeSession}
            value={assistSurfacePreference}
            onChange={(event) =>
              onAssistSurfacePreferenceChange(
                event.target.value as AssistSurfacePreference,
              )
            }
          >
            {appleLocalAssistAllowed ? (
              <option value="apple-local">{copy.assistSurfaceApple}</option>
            ) : null}
            {externalCliAllowed ? (
              <option value="external-cli">
                {copy.assistSurfaceExternalCli}
              </option>
            ) : null}
            <option value="none">{copy.assistSurfaceNone}</option>
          </select>
        </label>
        {assistSurfaceRestartRequired ? (
          <div className="preference-warning restart-warning">
            <span>{copy.assistSurfaceRestartRequired}</span>
            <button disabled={restartPending} onClick={onRestart} type="button">
              {restartPending ? copy.restarting : copy.restartNow}
            </button>
          </div>
        ) : null}
      </section>

      {showAppleSettings ? (
        <section
          aria-label={copy.appleSectionLabel}
          className="preference-section"
        >
          <div className="preference-section-title-row">
            <h3>{copy.appleHeading}</h3>
            <span className="preference-preview-badge">
              {copy.applePreviewLabel}
            </span>
          </div>
          <div
            className={`preference-availability-card preference-availability-card-${appleAvailabilityPresentation.tone}`}
            data-testid="apple-assist-availability-card"
            role="status"
          >
            <span className="preference-availability-label">
              {appleAvailabilityPresentation.label}
            </span>
            <span className="preference-availability-detail">
              {appleAvailabilityPresentation.detail}
            </span>
          </div>
          <p className="preference-note">{copy.appleDescription}</p>
          <ul className="agent-consent-list">
            {copy.appleNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {showCliSettings ? (
        <>
          <section
            aria-label={copy.modeSectionLabel}
            className="preference-section"
          >
            <h3>{copy.modeHeading}</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={modePreference}
                onChange={(event) =>
                  onModePreferenceChange(event.target.checked)
                }
              />
              <span className="slider"></span>
              <span>{copy.enableAfterRestart}</span>
            </label>
            <p className="preference-note">
              {active ? copy.activeSessionMode : copy.safeSessionMode}
            </p>
            {restartRequired ? (
              <div className="preference-warning restart-warning">
                <span>{copy.restartRequired}</span>
                <button
                  disabled={restartPending}
                  onClick={onRestart}
                  type="button"
                >
                  {restartPending ? copy.restarting : copy.restartNow}
                </button>
              </div>
            ) : null}
          </section>
          <section
            aria-label={copy.sessionSectionLabel}
            className="preference-section"
          >
            <h3>{copy.sessionHeading}</h3>
            <div className="preference-status-grid">
              <span>{copy.provider}</span>
              <strong>{providerLabel}</strong>
              <span>{copy.session}</span>
              <strong>{sessionLabel}</strong>
              <span>{copy.workspace}</span>
              <strong title={workspaceRootPath ?? undefined}>
                {workspaceRootPath ?? copy.noWorkspace}
              </strong>
            </div>
            {active ? (
              <>
                <label className="field-control">
                  <span>{copy.provider}</span>
                  <select
                    aria-label={copy.providerControl}
                    disabled={activeSession}
                    value={provider}
                    onChange={(event) =>
                      onProviderChange(
                        event.target.value as AgentWorkbenchProvider,
                      )
                    }
                  >
                    {AGENT_WORKBENCH_PROVIDERS.map((providerOption) => {
                      const entry = availabilityByProvider.get(
                        providerOption.id,
                      );
                      const available = entry?.available ?? true;
                      return (
                        <option
                          key={providerOption.id}
                          disabled={!available}
                          value={providerOption.id}
                        >
                          {providerOption.label}
                          {entry && !entry.available
                            ? ` ${copy.providerNotInstalled}`
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {currentProviderUnavailable ? (
                  <p className="preference-note">
                    {copy.providerUnavailableHint}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
          <section
            aria-label={copy.boundarySectionLabel}
            className="preference-section"
          >
            <h3>{copy.boundaryHeading}</h3>
            <ul className="agent-consent-list">
              {copy.boundaryItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={consent}
                disabled={!active}
                onChange={(event) => onConsentChange(event.target.checked)}
              />
              <span className="slider"></span>
              <span>{copy.consent}</span>
            </label>
          </section>
        </>
      ) : null}
    </div>
  );
}

type AppleAssistAvailabilityPresentation = {
  detail: string;
  label: string;
  tone: AppleAssistAvailability["kind"];
};

function getAppleAssistAvailabilityPresentation(
  copy: AgentWorkbenchCopy,
  availability: AppleAssistAvailability,
): AppleAssistAvailabilityPresentation {
  if (availability.kind === "available") {
    return {
      detail: appleAssistAvailabilityLabel(copy, availability),
      label: copy.appleAvailabilityAvailableLabel,
      tone: "available",
    };
  }
  if (availability.kind === "unavailable") {
    return {
      detail: appleAssistAvailabilityLabel(copy, availability),
      label: copy.appleAvailabilityUnavailableLabel,
      tone: "unavailable",
    };
  }
  if (availability.kind === "disabled") {
    return {
      detail: appleAssistAvailabilityLabel(copy, availability),
      label: copy.appleAvailabilityDisabledLabel,
      tone: "disabled",
    };
  }
  return {
    detail: appleAssistAvailabilityLabel(copy, availability),
    label: copy.appleAvailabilityUnsupportedLabel,
    tone: "unsupported",
  };
}

function appleAssistAvailabilityLabel(
  copy: AgentWorkbenchCopy,
  availability: AppleAssistAvailability,
): string {
  if (availability.kind === "available") {
    return copy.appleLiveStatus;
  }
  if (availability.kind === "unavailable") {
    return `${copy.appleUnavailablePrefix}${availability.reason}`;
  }
  if (availability.kind === "disabled") {
    return copy.appleFixtureStatus;
  }
  return copy.appleUnsupportedStatus;
}
