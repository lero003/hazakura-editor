// `useAppShellRefs` is the ref-pool slice of the v0.9
// `useAppShellController` split. It bundles the two leaf hooks
// that own React refs and a few derived booleans (`useAppEditorRefs`
// + `useAppDialogRefs`) into a single typed composer the
// orchestrator can destructure from, so the orchestrator's public
// return shape stays byte-identical.
//
// The hook owns no new state of its own — it is a pure bundler.
// The 4-arg signature keeps the dep on `useEditorTabState` (a
// Slice C domain composer that provides `pendingCloseTab`) explicit
// rather than threading it through foundation, so when Slice C
// moves `useEditorTabState` into its own controller the orchestrator
// just re-reads `pendingCloseTab` from there without re-typing
// this hook.

import type { EditorTab, PreferencesDialogMode } from "../../types";
import { useAppDialogRefs } from "./useAppDialogRefs";
import { useAppEditorRefs } from "./useAppEditorRefs";

type UseAppShellRefsOptions = {
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  preferencesDialogMode: PreferencesDialogMode | null;
  tabs: EditorTab[];
};

export function useAppShellRefs({
  pendingAppClose,
  pendingCloseTab,
  preferencesDialogMode,
  tabs,
}: UseAppShellRefsOptions) {
  const editorRefs = useAppEditorRefs(tabs);
  const dialogRefs = useAppDialogRefs({
    pendingAppClose,
    pendingCloseTab,
    preferencesDialogMode,
  });
  return {
    ...editorRefs,
    ...dialogRefs,
  };
}
