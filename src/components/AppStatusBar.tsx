import { StatusBar } from "./StatusBar";
import type { EditableLineEnding, EditorTab } from "../types";
import type { AgentWorkbenchProvider } from "../tauri";
import type { MenuLanguage } from "../types";
import { localizeStatusMessage } from "../statusMessages";
import { providerLabel } from "../agentWorkbench";

type AppStatusBarProps = {
  activeAgentSession: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  detail: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  menuLanguage: MenuLanguage;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  status: string;
};

export function AppStatusBar({
  activeAgentSession,
  activeTab,
  agentWorkbenchActive,
  agentWorkbenchProvider,
  detail,
  lineEndingAriaLabel,
  lineEndingLabel,
  menuLanguage,
  onConvertLineEnding,
  saveAffirmation,
  saveAffirmationKey,
  status,
}: AppStatusBarProps) {
  return (
    <StatusBar
      activeTab={activeTab}
      agentLabel={
        agentWorkbenchActive && activeAgentSession
          ? providerLabel(agentWorkbenchProvider)
          : null
      }
      detail={detail}
      lineEndingAriaLabel={lineEndingAriaLabel}
      lineEndingLabel={lineEndingLabel}
      onConvertLineEnding={onConvertLineEnding}
      saveAffirmation={saveAffirmation}
      saveAffirmationKey={saveAffirmationKey}
      statusText={localizeStatusMessage(status, menuLanguage)}
    />
  );
}
