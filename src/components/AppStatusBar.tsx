import { StatusBar } from "./StatusBar";
import type { AgentWorkbenchProvider } from "../tauri";
import type { MenuLanguage } from "../types";
import { localizeStatusMessage } from "../statusMessages";
import { providerLabel } from "../utils";

type AppStatusBarProps = {
  activeAgentSession: boolean;
  agentWorkbenchActive: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  detail: string;
  menuLanguage: MenuLanguage;
  status: string;
};

export function AppStatusBar({
  activeAgentSession,
  agentWorkbenchActive,
  agentWorkbenchProvider,
  detail,
  menuLanguage,
  status,
}: AppStatusBarProps) {
  return (
    <StatusBar
      agentLabel={
        agentWorkbenchActive && activeAgentSession
          ? providerLabel(agentWorkbenchProvider)
          : null
      }
      detail={detail}
      statusText={localizeStatusMessage(status, menuLanguage)}
    />
  );
}
