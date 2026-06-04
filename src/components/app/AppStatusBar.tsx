import { StatusBar } from "./StatusBar";
import type { EditableLineEnding, EditorTab, TextEncoding } from "../../types";
import type { AgentWorkbenchProvider } from "../../lib/tauri";
import type { MenuLanguage } from "../../types";
import type { LModeCopy } from "../../lib/locale";
import { localizeStatusMessage } from "../../lib/statusMessages";
import { providerLabel } from "../../features/agent/agentWorkbench";

type AppStatusBarProps = {
  activeAgentSession: boolean;
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  detail: string;
  encodingAriaLabel: string;
  encodingLabel: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeCopy: LModeCopy;
  lModeEnabled: boolean;
  menuLanguage: MenuLanguage;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  onExitLModeToWorkspace: () => void;
  onReviewChangesFromLMode: () => void;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  status: string;
};

export function AppStatusBar({
  activeAgentSession,
  activeDirty,
  activeTab,
  agentWorkbenchActive,
  agentWorkbenchProvider,
  detail,
  encodingAriaLabel,
  encodingLabel,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeCopy,
  lModeEnabled,
  menuLanguage,
  onConvertEncoding,
  onConvertLineEnding,
  onExitLModeToWorkspace,
  onReviewChangesFromLMode,
  saveAffirmation,
  saveAffirmationKey,
  status,
}: AppStatusBarProps) {
  return (
    <StatusBar
      activeTab={activeTab}
      agentLabel={
        !lModeEnabled && agentWorkbenchActive && activeAgentSession
          ? providerLabel(agentWorkbenchProvider)
          : null
      }
      detail={detail}
      encodingAriaLabel={encodingAriaLabel}
      encodingLabel={encodingLabel}
      lineEndingAriaLabel={lineEndingAriaLabel}
      lineEndingLabel={lineEndingLabel}
      lModeCopy={lModeEnabled ? lModeCopy : null}
      lModeEnabled={lModeEnabled}
      onConvertEncoding={onConvertEncoding}
      onConvertLineEnding={onConvertLineEnding}
      onExitLModeToWorkspace={onExitLModeToWorkspace}
      onReviewChangesFromLMode={onReviewChangesFromLMode}
      reviewChangesAvailable={activeDirty}
      saveAffirmation={saveAffirmation}
      saveAffirmationKey={saveAffirmationKey}
      statusText={localizeStatusMessage(status, menuLanguage)}
    />
  );
}
