import type { AgentWorkbenchCopy } from "../../lib/locale";
import type { AgentWorkbenchProvider } from "../../lib/tauri";
import { useAgentProviderAvailability } from "../../hooks/agent/useAgentProviderAvailability";
import { AGENT_WORKBENCH_PROVIDERS } from "../../types";

type AgentWorkbenchPreferencesPaneProps = {
  active: boolean;
  activeSession: boolean;
  consent: boolean;
  copy: AgentWorkbenchCopy;
  modePreference: boolean;
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
  consent,
  copy,
  modePreference,
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
  const { availabilityByProvider } = useAgentProviderAvailability();
  const currentAvailability = availabilityByProvider.get(provider);
  const currentProviderUnavailable =
    currentAvailability !== undefined && !currentAvailability.available;

  return (
    <div className="agent-workbench-settings">
      <section aria-label={copy.modeSectionLabel} className="preference-section">
        <h3>{copy.modeHeading}</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={modePreference}
            onChange={(event) => onModePreferenceChange(event.target.checked)}
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
            <button disabled={restartPending} onClick={onRestart} type="button">
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
                  onProviderChange(event.target.value as AgentWorkbenchProvider)
                }
              >
                {AGENT_WORKBENCH_PROVIDERS.map((providerOption) => {
                  const entry = availabilityByProvider.get(providerOption.id);
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
              <p className="preference-note">{copy.providerUnavailableHint}</p>
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
    </div>
  );
}
