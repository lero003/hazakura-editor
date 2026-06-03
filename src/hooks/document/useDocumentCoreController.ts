// `useDocumentCoreController` is the second domain-composer slice
// of the v0.9 `useAppShellController` split. It composes
// `useEditorTabState` (10 fields) and `usePastedImageAction` (1
// field) into a single typed surface. Both are available before
// `useImagePreview` is called (neither depends on `selectedImage`),
// so the new hook slots into the same position as the old
// `useEditorTabState` section without reordering.
//
// The hook owns no new state of its own — it is a pure bundler.
// The 7-arg signature is the union of the two bundled signatures.
// `usePastedImageAction`'s `handlePasteImage` is destructured from
// the new controller and used downstream just like it was when
// `usePastedImageAction` was called inline at the bottom of the
// orchestrator; collapsing the inline call into the new controller
// makes the local variable available earlier, which is harmless
// because it has no other consumers between the inline call and
// the return object.
//
// `useActiveDocumentIdentity` is NOT folded into this controller
// because it depends on `selectedImage` (from `useImagePreview`)
// which is not available at this call site. It stays inline for
// now and is a candidate for a future `useDocumentIdentityController`
// wrap.

import type { Dispatch, SetStateAction } from "react";
import type { DraftRecord, EditorTab } from "../../types";
import { usePastedImageAction } from "./usePastedImageAction";
import { useEditorTabState } from "../editor/useEditorTabState";

type UseDocumentCoreControllerOptions = {
  activeTabId: string | null;
  globalError: string | null;
  pendingCloseTabId: string | null;
  pendingDrafts: DraftRecord[];
  setStatus: Dispatch<SetStateAction<string>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useDocumentCoreController({
  activeTabId,
  globalError,
  pendingCloseTabId,
  pendingDrafts,
  setStatus,
  tabs,
  workspaceRootPath,
}: UseDocumentCoreControllerOptions) {
  const editorTabState = useEditorTabState({
    activeTabId,
    globalError,
    pendingCloseTabId,
    pendingDrafts,
    tabs,
  });
  const pastedImage = usePastedImageAction({
    activeTabPath: editorTabState.activeTab?.path ?? null,
    setStatus,
    workspaceRootPath,
  });
  return {
    ...editorTabState,
    ...pastedImage,
  };
}
