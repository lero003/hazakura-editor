// `useDocumentPreviewController` is the third domain-composer
// slice of the v0.9 `useAppShellController` split. It composes
// `useImagePreview` (5 fields) and `useActiveDocumentIdentity` (4
// fields) into a single typed surface.
//
// The composition is real (not a rename) because
// `useActiveDocumentIdentity` consumes `selectedImage` produced
// by `useImagePreview` — folding the wiring into the new
// controller removes one cross-section handoff in the
// orchestrator. Both bundled hooks are available in the
// orchestrator at the image-preview position (no upstream deps
// other than the foundation + C-2's `activeTab`), so the new
// section slots into the same spot as the old image-preview
// block without reordering.
//
// The hook owns no new state of its own — it is a pure
// bundler. The 9-arg signature is the union of the two bundled
// signatures. `selectedImage` is exposed in the return so
// downstream consumers (side-pane, document-surface, runtime
// effects) can read it without the orchestrator having to call
// `useImagePreview` a second time.

import type { Dispatch, SetStateAction } from "react";
import type {
  CompareViewState,
  EditorTab,
} from "../../types";
import { useImagePreview } from "../editor/useImagePreview";
import { useActiveDocumentIdentity } from "./useActiveDocumentIdentity";

type UseDocumentPreviewControllerOptions = {
  activeTab: EditorTab | null;
  activeTabId: string | null;
  onError: (message: string | null) => void;
  onStatus: (message: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useDocumentPreviewController({
  activeTab,
  activeTabId,
  onError,
  onStatus,
  setActiveTabId,
  setCompareView,
  tabs,
  workspaceRootPath,
}: UseDocumentPreviewControllerOptions) {
  const imagePreview = useImagePreview({
    activeTabId,
    onError,
    onStatus,
    setActiveTabId,
    setCompareView,
    tabs,
    workspaceRootPath,
  });
  const identity = useActiveDocumentIdentity({
    activeTab,
    selectedImage: imagePreview.selectedImage,
  });
  return {
    ...imagePreview,
    ...identity,
  };
}
