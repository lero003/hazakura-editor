import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  createTextFile,
  createTextFolder,
  listWorkspaceDirectory,
} from "../../lib/tauri";
import type { TextFileDocument, WorkspaceTreeEntry } from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import { fileNameFromPath, parentFolderName } from "../../lib/utils";
import type { CompareViewState, EditorTab } from "../../types";

type UseWorkspaceFileOpsOptions = {
  clearImagePreview: () => void;
  reloadWorkspaceParent: (parentPath: string) => Promise<void>;
  rememberRecentFile: (path: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

const DEFAULT_FILE_BASENAME = "untitled";
const DEFAULT_FILE_EXTENSION = ".md";
const DEFAULT_FOLDER_NAME = "untitled-folder";

// Find a sibling name not present in `existingNames`. Tries
// `<base>`, `<base>-2`, `<base>-3`, ... and returns null if the
// workspace tree has not been loaded yet (caller treats null as
// "defer the uniqueness check, let the backend reject on race").
function nextAvailableName(
  base: string,
  suffix: string,
  existingNames: Set<string> | null,
): string {
  if (existingNames === null) {
    return `${base}${suffix}`;
  }
  if (!existingNames.has(`${base}${suffix}`)) {
    return `${base}${suffix}`;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}${suffix}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }
  return `${base}${suffix}`;
}

export function useWorkspaceFileOps({
  clearImagePreview,
  reloadWorkspaceParent,
  rememberRecentFile,
  setActiveTabId,
  setCompareView,
  setGlobalError,
  setStatus,
  setTabs,
  tabs,
  workspaceRootPath,
}: UseWorkspaceFileOpsOptions) {
  const collectExistingNames = useCallback(
    async (parentPath: string): Promise<Set<string> | null> => {
      if (!workspaceRootPath) {
        return null;
      }
      try {
        const listing = await listWorkspaceDirectory(
          workspaceRootPath,
          parentPath,
        );
        return new Set(listing.children.map((child) => child.name));
      } catch {
        return null;
      }
    },
    [workspaceRootPath],
  );

  const createFile = useCallback(
    async (parentPath: string) => {
      if (!workspaceRootPath) {
        setStatus("No workspace open");
        return;
      }

      setGlobalError(null);
      setStatus("Creating file...");

      try {
        const existingNames = await collectExistingNames(parentPath);
        const name = nextAvailableName(
          DEFAULT_FILE_BASENAME,
          DEFAULT_FILE_EXTENSION,
          existingNames,
        );
        const fullPath = `${parentPath}/${name}`;

        // Backend `create_text_file` rejects with an error if the
        // path already exists, so a race with another tab / agent
        // process is caught here even though the uniqueness check
        // above is best-effort.
        const file: TextFileDocument = await createTextFile(fullPath);
        const nextTab = createEditorTab(file);

        setTabs((currentTabs) =>
          currentTabs.some((tab) => tab.path === fullPath)
            ? currentTabs
            : [...currentTabs, nextTab],
        );
        setActiveTabId(fullPath);
        clearImagePreview();
        setCompareView(null);
        rememberRecentFile(fullPath);

        // Refresh the parent so the new file is visible in the
        // tree, including if the parent was previously collapsed
        // — the splice widens it.
        try {
          await reloadWorkspaceParent(parentPath);
        } catch {
          setStatus("New file created; folder refresh failed");
          return;
        }

        setStatus(`New file created: ${fileNameFromPath(fullPath)}`);
      } catch (err) {
        setGlobalError(String(err));
        setStatus("New file failed");
      }
    },
    [
      clearImagePreview,
      collectExistingNames,
      reloadWorkspaceParent,
      rememberRecentFile,
      setActiveTabId,
      setCompareView,
      setGlobalError,
      setStatus,
      setTabs,
      workspaceRootPath,
    ],
  );

  const createFolder = useCallback(
    async (parentPath: string) => {
      if (!workspaceRootPath) {
        setStatus("No workspace open");
        return;
      }

      setGlobalError(null);
      setStatus("Creating folder...");

      try {
        const existingNames = await collectExistingNames(parentPath);
        const name = nextAvailableName(
          DEFAULT_FOLDER_NAME,
          "",
          existingNames,
        );
        const fullPath = `${parentPath}/${name}`;

        await createTextFolder(fullPath, workspaceRootPath);

        try {
          await reloadWorkspaceParent(parentPath);
        } catch {
          setStatus("New folder created; folder refresh failed");
          return;
        }

        setStatus(
          `New folder created: ${fileNameFromPath(fullPath) ||
            parentFolderName(fullPath)}`,
        );
      } catch (err) {
        setGlobalError(String(err));
        setStatus("New folder failed");
      }
    },
    [
      collectExistingNames,
      reloadWorkspaceParent,
      setGlobalError,
      setStatus,
      workspaceRootPath,
    ],
  );

  // Used as a stable opener after a successful createFile when the
  // tab may already exist (race): just focus it. Mirrors the lookup
  // in useFileOpening.createNewFile.
  const focusIfAlreadyOpen = useCallback(
    (path: string): boolean => {
      const existing = tabs.find((tab) => tab.path === path);
      if (!existing) {
        return false;
      }
      setActiveTabId(path);
      clearImagePreview();
      setCompareView(null);
      rememberRecentFile(path);
      return true;
    },
    [clearImagePreview, rememberRecentFile, setActiveTabId, setCompareView, tabs],
  );

  return {
    createFile,
    createFolder,
    focusIfAlreadyOpen,
  };
}
