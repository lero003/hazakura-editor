import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EditorSettings, EditorTab, RightPaneMode } from "../../types";
import { isLModeSupportedDocument } from "../../features/editor/lMode/documentSupport";
import type { ChangeReviewSnapshot } from "../diff/useCompareExecution";

type Options = {
  activeTab: EditorTab | null;
  editorSettings: EditorSettings;
  prepareReviewTabAgainstDisk: (tab: EditorTab) => Promise<ChangeReviewSnapshot | null>;
  referenceCompareActive: boolean;
  referenceRetainedStatus: string;
  rightPaneMode: RightPaneMode;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  setStatus: (message: string) => void;
  sidePaneOpen: boolean;
};

// Own the presentation transition and its return snapshot; document contents
// and the editor's IME/Undo lifecycle remain with the editor.
export function useLModeActions({
  activeTab,
  editorSettings,
  prepareReviewTabAgainstDisk,
  referenceCompareActive,
  referenceRetainedStatus,
  rightPaneMode,
  setEditorSettings,
  setRightPaneMode,
  setSidePaneOpen,
  setStatus,
  sidePaneOpen,
}: Options) {
  // L Mode (えるモード) is Markdown-only. CSS/HTML remount switches the
  // parser and drops undo history; refuse non-Markdown with a status note.
  const toggleLMode = useCallback(() => {
    setEditorSettings((current) => {
      if (current.lModeEnabled) {
        return { ...current, lModeEnabled: false };
      }
      const key = activeTab?.path || activeTab?.name || "";
      if (!isLModeSupportedDocument(key)) {
        setStatus(
          "L Mode is for Markdown writing. Open a .md file to use L Mode.",
        );
        return current;
      }
      return { ...current, lModeEnabled: true };
    });
  }, [activeTab?.name, activeTab?.path, setEditorSettings, setStatus]);

  const exitLMode = useCallback(() => {
    setEditorSettings((current) => ({
      ...current,
      lModeEnabled: false,
    }));
  }, [setEditorSettings]);

  // Leave L Mode when the active document is not Markdown so CSS/HTML
  // never remount through the Markdown parser while L Mode stays on.
  useEffect(() => {
    if (!editorSettings.lModeEnabled) {
      return;
    }
    const key = activeTab?.path || activeTab?.name || "";
    if (!isLModeSupportedDocument(key)) {
      setEditorSettings((current) =>
        current.lModeEnabled ? { ...current, lModeEnabled: false } : current,
      );
      setStatus("L Mode left because this file is not Markdown.");
    }
  }, [
    activeTab?.name,
    activeTab?.path,
    editorSettings.lModeEnabled,
    setEditorSettings,
    setStatus,
  ]);

  // Escape hatch surfaced in the L Mode action rail. This
  // returns a local diff snapshot so L Mode can show a small
  // review window without opening the normal edit surface's
  // right pane.
  const reviewChangesFromLMode = useCallback(async () => {
    if (!activeTab) {
      return null;
    }
    return prepareReviewTabAgainstDisk(activeTab);
  }, [activeTab, prepareReviewTabAgainstDisk]);
  const exitLModeToWorkspace = useCallback(() => {
    exitLMode();
  }, [exitLMode]);

  // T-1 L Mode continuity: snapshot side-pane mode on entry and restore
  // on exit. Compare anchors are intentionally kept in memory (not
  // cleared) so returning from L Mode does not discard a review setup.
  const lModeSurfaceSnapshotRef = useRef<{
    sidePaneOpen: boolean;
    rightPaneMode: typeof rightPaneMode;
  } | null>(null);
  const wasLModeEnabledRef = useRef(editorSettings.lModeEnabled);
  const sidePaneOpenRef = useRef(sidePaneOpen);
  const rightPaneModeRef = useRef(rightPaneMode);
  sidePaneOpenRef.current = sidePaneOpen;
  rightPaneModeRef.current = rightPaneMode;

  useEffect(() => {
    const wasEnabled = wasLModeEnabledRef.current;
    const isEnabled = editorSettings.lModeEnabled;

    if (!wasEnabled && isEnabled) {
      lModeSurfaceSnapshotRef.current = {
        sidePaneOpen: sidePaneOpenRef.current,
        rightPaneMode: rightPaneModeRef.current,
      };
      setSidePaneOpen(false);
      if (referenceCompareActive) {
        setStatus(referenceRetainedStatus);
      }
    } else if (wasEnabled && !isEnabled) {
      const snapshot = lModeSurfaceSnapshotRef.current;
      lModeSurfaceSnapshotRef.current = null;
      if (snapshot) {
        setSidePaneOpen(snapshot.sidePaneOpen);
        setRightPaneMode(snapshot.rightPaneMode);
      }
    }

    wasLModeEnabledRef.current = isEnabled;
  }, [
    editorSettings.lModeEnabled,
    referenceCompareActive,
    setRightPaneMode,
    setSidePaneOpen,
    setStatus,
    referenceRetainedStatus,
  ]);

  return { toggleLMode, exitLMode, exitLModeToWorkspace, reviewChangesFromLMode };
}
