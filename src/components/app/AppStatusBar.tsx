import { StatusBar } from "./StatusBar";
import type { EditableLineEnding, EditorTab, TextEncoding } from "../../types";
import type { AgentWorkbenchProvider } from "../../lib/tauri";
import type { MenuLanguage } from "../../types";
import { localizeStatusMessage } from "../../lib/statusMessages";
import { providerLabel } from "../../features/agent/agentWorkbench";

type AppStatusBarProps = {
  activeAgentSession: boolean;
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  detail: string;
  dirtyLabel: string;
  encodingAriaLabel: string;
  encodingLabel: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeEnabled: boolean;
  menuLanguage: MenuLanguage;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
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
  dirtyLabel,
  encodingAriaLabel,
  encodingLabel,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeEnabled,
  menuLanguage,
  onConvertEncoding,
  onConvertLineEnding,
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
      dirtyLabel={dirtyLabel}
      encodingAriaLabel={encodingAriaLabel}
      encodingLabel={encodingLabel}
      lineEndingAriaLabel={lineEndingAriaLabel}
      lineEndingLabel={lineEndingLabel}
      lModeEnabled={lModeEnabled}
      onConvertEncoding={onConvertEncoding}
      onConvertLineEnding={onConvertLineEnding}
      saveAffirmation={saveAffirmation}
      saveAffirmationKey={saveAffirmationKey}
      statusText={localizeStatusMessage(status, menuLanguage)}
    />
  );
}
