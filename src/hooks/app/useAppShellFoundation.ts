// `useAppShellFoundation` is the state-pool slice of the v0.9
// `useAppShellController` split. It bundles the 17 leaf hooks in
// the orchestrator that take no cross-hook arguments and returns
// a flat object the orchestrator can destructure from, so the
// orchestrator's public return shape stays byte-identical.
//
// The hook owns no new state of its own — it is a pure
// pass-through. The value is the typed surface it exposes and the
// place to add cross-dep logic in later slices (refs, then domain
// composers) without re-touching the orchestrator. Leaf hooks
// keep their existing return shapes; only `useSaveAffirmation` is
// renamed (its `affirmation` / `lastAffirmedAt` are re-exposed as
// `saveAffirmation` / `saveAffirmationKey`) so the orchestrator's
// existing destructuring is unchanged.

import { useAgentOutputBuffer } from "../agent/useAgentOutputBuffer";
import { useAgentUiRefreshGate } from "../agent/useAgentUiRefreshGate";
import { useAgentWorkbenchPreferences } from "../agent/useAgentWorkbenchPreferences";
import { useAgentWorkbenchRuntimeState } from "../agent/useAgentWorkbenchRuntimeState";
import { useCompareState } from "../diff/useCompareState";
import { useDraftRecoveryState } from "../document/useDraftRecoveryState";
import { useSaveAffirmation } from "../document/useSaveAffirmation";
import { useEditorSelectionState } from "../editor/useEditorSelectionState";
import { useEditorTabsState } from "../editor/useEditorTabsState";
import { useReviewDeskState } from "../review/useReviewDeskState";
import { useQuickOpenState } from "../workspace/useQuickOpenState";
import { useRecentEntries } from "../workspace/useRecentEntries";
import { useWorkspaceContextMenu } from "../workspace/useWorkspaceContextMenu";
import { useWorkspaceShellState } from "../workspace/useWorkspaceShellState";
import { useAppDialogState } from "./useAppDialogState";
import { useAppFeedbackState } from "./useAppFeedbackState";
import { useAppPreferences } from "./useAppPreferences";
import { useAppViewState } from "./useAppViewState";

export function useAppShellFoundation() {
  const dialogState = useAppDialogState();
  const viewState = useAppViewState();
  const feedbackState = useAppFeedbackState();
  const appPreferences = useAppPreferences();
  const editorTabs = useEditorTabsState();
  const editorSelection = useEditorSelectionState();
  const diffState = useCompareState();
  const workspaceShell = useWorkspaceShellState();
  const recentEntries = useRecentEntries();
  const draftRecovery = useDraftRecoveryState();
  const agentPrefs = useAgentWorkbenchPreferences();
  const agentRuntime = useAgentWorkbenchRuntimeState();
  const agentOutput = useAgentOutputBuffer();
  const agentUiGate = useAgentUiRefreshGate();
  const reviewDesk = useReviewDeskState();
  const quickOpen = useQuickOpenState();
  const workspaceContextMenu = useWorkspaceContextMenu();

  const { affirmation, lastAffirmedAt } = useSaveAffirmation(
    feedbackState.status,
  );

  return {
    ...dialogState,
    ...viewState,
    ...feedbackState,
    ...appPreferences,
    ...editorTabs,
    ...editorSelection,
    ...diffState,
    ...workspaceShell,
    ...recentEntries,
    ...draftRecovery,
    ...agentPrefs,
    ...agentRuntime,
    ...agentOutput,
    ...agentUiGate,
    ...reviewDesk,
    ...quickOpen,
    ...workspaceContextMenu,
    saveAffirmation: affirmation,
    saveAffirmationKey: lastAffirmedAt,
  };
}
