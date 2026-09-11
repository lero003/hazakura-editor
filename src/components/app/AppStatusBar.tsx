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
  secondaryDetail: string;
  dirtyLabel: string;
  encodingAriaLabel: string;
  encodingChipTitle: string;
  encodingLabel: string;
  encodingReopenBlocked: string;
  encodingReopenGroup: string;
  encodingSaveGroup: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeEnabled: boolean;
  menuLanguage: MenuLanguage;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onReopenEncoding?: (encoding: TextEncoding) => void;
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
  secondaryDetail,
  dirtyLabel,
  encodingAriaLabel,
  encodingChipTitle,
  encodingLabel,
  encodingReopenBlocked,
  encodingReopenGroup,
  encodingSaveGroup,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeEnabled,
  menuLanguage,
  onConvertEncoding,
  onReopenEncoding,
  onConvertLineEnding,
  saveAffirmation,
  saveAffirmationKey,
  status,
}: AppStatusBarProps) {
  return (
    <StatusBar
      activeDirty={activeDirty}
      activeTab={activeTab}
      agentLabel={
        !lModeEnabled && agentWorkbenchActive && activeAgentSession
          ? providerLabel(agentWorkbenchProvider)
          : null
      }
      detail={detail}
      secondaryDetail={secondaryDetail}
      dirtyLabel={dirtyLabel}
      encodingAriaLabel={encodingAriaLabel}
      encodingChipTitle={encodingChipTitle}
      encodingLabel={encodingLabel}
      encodingReopenBlocked={encodingReopenBlocked}
      encodingReopenGroup={encodingReopenGroup}
      encodingSaveGroup={encodingSaveGroup}
      lineEndingAriaLabel={lineEndingAriaLabel}
      lineEndingLabel={lineEndingLabel}
      lModeEnabled={lModeEnabled}
      onConvertEncoding={onConvertEncoding}
      onReopenEncoding={onReopenEncoding}
      onConvertLineEnding={onConvertLineEnding}
      saveAffirmation={saveAffirmation}
      saveAffirmationKey={saveAffirmationKey}
      statusText={localizeStatusMessage(status, menuLanguage)}
    />
  );
}
