import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import {
  createTextFile,
  createTextFolder,
  listWorkspaceDirectory,
  moveWorkspaceEntry,
  moveWorkspaceEntryToTrash,
  renameWorkspaceEntry,
} from "../../lib/tauri";
import type { TextFileDocument, WorkspaceTreeEntry } from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import { fileNameFromPath, parentFolderName } from "../../lib/utils";
import { isDirty } from "../../features/editor/editorTabs";
import { useEditorTabsPathRekey } from "../editor/useEditorTabsPathRekey";
import type {
  CompareAnchor,
  CompareViewState,
  DraftRecord,
  EditorTab,
  RecentEntry,
} from "../../types";
import type { RenameWarningKind } from "../../components/app/RenameWarnDialog";

type UseWorkspaceFileOpsOptions = {
  clearImagePreview: () => void;
  reloadWorkspaceParent: (parentPath: string) => Promise<void>;
  rememberRecentFile: (path: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareAnchor: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareTarget: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setRecentFiles: Dispatch<SetStateAction<RecentEntry[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

type PendingRename = {
  srcPath: string;
  newPath: string;
  newName: string;
  parentPath: string;
  warningKind: RenameWarningKind;
};

type PendingTrash = {
  srcPath: string;
  parentPath: string;
  // The basename drives the dialog copy so the user sees the
  // exact name they're about to discard.
  name: string;
  isDirectory: boolean;
};

const DEFAULT_FILE_BASENAME = "untitled";
const DEFAULT_FILE_EXTENSION = ".md";
const DEFAULT_FOLDER_NAME = "untitled-folder";

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
  setCompareAnchor,
  setCompareTarget,
  setCompareView,
  setGlobalError,
  setPendingDrafts,
  setRecentFiles,
  setStatus,
  setTabs,
  tabs,
  workspaceRootPath,
}: UseWorkspaceFileOpsOptions) {
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(
    null,
  );
  const [pendingTrash, setPendingTrash] = useState<PendingTrash | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const { rekeyPath } = useEditorTabsPathRekey({
    setActiveTabId,
    setCompareAnchor,
    setCompareTarget,
    setCompareView,
    setPendingDrafts,
    setRecentFiles,
    setTabs,
  });

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
        const file: TextFileDocument = await createTextFile(
          fullPath,
          workspaceRootPath,
        );
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

  // Internal: actually perform the rename (after any warn dialog
  // resolves). Splice the parent so the tree reflects the new
  // name, fan out all editor state via rekeyPath, and clear the
  // tree's inline rename input.
  const performRename = useCallback(
    async (srcPath: string, newPath: string, parentPath: string) => {
      if (!workspaceRootPath) {
        setStatus("No workspace open");
        return;
      }

      setGlobalError(null);
      setStatus("Renaming...");

      try {
        await renameWorkspaceEntry(srcPath, newPath, workspaceRootPath);
        rekeyPath(srcPath, newPath);
        setRenamingPath(null);
        try {
          await reloadWorkspaceParent(parentPath);
        } catch {
          setStatus("Renamed; folder refresh failed");
          return;
        }
        setStatus(`Renamed to ${fileNameFromPath(newPath)}`);
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Rename failed");
      }
    },
    [
      rekeyPath,
      reloadWorkspaceParent,
      setGlobalError,
      setStatus,
      workspaceRootPath,
    ],
  );

  // Detect whether a rename needs a warn dialog. The two warning
  // cases are: (1) the open tab is dirty — the user may want to
  // save first; (2) the file was modified outside the app, signaled
  // by saveStatus === "conflict" (set by useExternalChangeActions).
  // External warning wins if both apply — the user has more to
  // lose from an unseen external change than from a dirty buffer.
  const detectRenameWarning = useCallback(
    (srcPath: string): RenameWarningKind | null => {
      const tab = tabs.find((candidate) => candidate.path === srcPath);
      if (!tab) return null;
      if (tab.saveStatus === "conflict") {
        return "external";
      }
      if (isDirty(tab)) {
        return "dirty";
      }
      return null;
    },
    [tabs],
  );

  // Public entry: called from the inline tree rename. `newName` is
  // the user-typed name (no path). If a warn is needed, sets
  // pendingRename and returns; otherwise performs the rename.
  const renameWorkspacePath = useCallback(
    async (srcPath: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        setStatus("Rename cancelled");
        return;
      }
      const slashIndex = srcPath.lastIndexOf("/");
      const parentPath = slashIndex === -1 ? "" : srcPath.slice(0, slashIndex);
      const newPath = `${parentPath}/${trimmed}`;
      if (newPath === srcPath) {
        setStatus("Rename cancelled");
        return;
      }
      const warningKind = detectRenameWarning(srcPath);
      if (warningKind) {
        setPendingRename({
          srcPath,
          newPath,
          newName: trimmed,
          parentPath,
          warningKind,
        });
        return;
      }
      await performRename(srcPath, newPath, parentPath);
    },
    [detectRenameWarning, performRename, setStatus],
  );

  const confirmPendingRename = useCallback(async () => {
    const pending = pendingRename;
    if (!pending) return;
    setPendingRename(null);
    await performRename(pending.srcPath, pending.newPath, pending.parentPath);
  }, [pendingRename, performRename]);

  const cancelPendingRename = useCallback(() => {
    setPendingRename(null);
    setStatus("Rename cancelled");
  }, [setStatus]);

  // Drag-to-move: drop a workspace entry on a folder (or the
  // workspace root) and we move the source into the destination
  // directory. The drop's `dstParentPath` is the directory the
  // user dropped onto. We compute the new path, call the Tauri
  // command, fan out the tab path, and refresh both parents.
  const moveWorkspacePath = useCallback(
    async (srcPath: string, dstParentPath: string) => {
      if (!workspaceRootPath) {
        setStatus("No workspace open");
        return;
      }

      const slashIndex = srcPath.lastIndexOf("/");
      const name = slashIndex === -1 ? srcPath : srcPath.slice(slashIndex + 1);
      const newPath = `${dstParentPath}/${name}`;

      if (newPath === srcPath) {
        setStatus("Move cancelled");
        return;
      }

      // Reject dropping a folder onto one of its descendants —
      // the backend would also reject (it'd move a directory
      // inside itself), but a friendly message saves a round trip.
      if (
        dstParentPath === srcPath ||
        dstParentPath.startsWith(`${srcPath}/`)
      ) {
        setGlobalError("Cannot move a folder into itself.");
        setStatus("Move failed");
        return;
      }

      const srcParent =
        slashIndex === -1 ? "" : srcPath.slice(0, slashIndex);

      setGlobalError(null);
      setStatus("Moving...");

      try {
        await moveWorkspaceEntry(srcPath, newPath, workspaceRootPath);
        rekeyPath(srcPath, newPath);
        // Refresh both parents (source + destination) so the
        // move is visible from both sides of the tree.
        try {
          await Promise.all([
            srcParent ? reloadWorkspaceParent(srcParent) : Promise.resolve(),
            reloadWorkspaceParent(dstParentPath),
          ]);
        } catch {
          setStatus("Moved; folder refresh failed");
          return;
        }
        setStatus(`Moved to ${dstParentPath}`);
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Move failed");
      }
    },
    [
      reloadWorkspaceParent,
      rekeyPath,
      setGlobalError,
      setStatus,
      workspaceRootPath,
    ],
  );

  // Move-to-trash: a two-step flow so the user always confirms
  // before the file disappears. `requestTrashWorkspacePath`
  // stashes the trashed entry into `pendingTrash` and surfaces
  // the confirm dialog; `confirmPendingTrash` actually invokes
  // the Tauri command, fans the path out, and reloads the
  // parent.
  const requestTrashWorkspacePath = useCallback(
    (srcPath: string, name: string, isDirectory: boolean) => {
      const slashIndex = srcPath.lastIndexOf("/");
      const parentPath =
        slashIndex === -1 ? "" : srcPath.slice(0, slashIndex);
      setPendingTrash({ srcPath, parentPath, name, isDirectory });
    },
    [],
  );

  const cancelPendingTrash = useCallback(() => {
    setPendingTrash(null);
  }, []);

  const confirmPendingTrash = useCallback(async () => {
    const pending = pendingTrash;
    if (!pending || !workspaceRootPath) {
      setPendingTrash(null);
      return;
    }
    setPendingTrash(null);
    setGlobalError(null);
    setStatus("Moving to Trash...");

    try {
      await moveWorkspaceEntryToTrash(pending.srcPath, workspaceRootPath);
      // The trashed path is gone, so the editor fan-out closes
      // the affected tab / draft / recent / compare slot. This
      // is the same set of stores that `rekeyPath` rewrites
      // for rename, but for trash the right answer is to drop
      // the entry entirely instead of remapping to a new path.
      const trashedPath = pending.srcPath;
      setTabs((currentTabs) => currentTabs.filter((tab) => tab.id !== trashedPath));
      setActiveTabId((current) => (current === trashedPath ? null : current));
      setPendingDrafts((currentDrafts) =>
        currentDrafts.filter((draft) => draft.path !== trashedPath),
      );
      setRecentFiles((currentEntries) =>
        currentEntries.filter((entry) => entry.path !== trashedPath),
      );
      setCompareAnchor((current) =>
        current && current.path === trashedPath ? null : current,
      );
      setCompareTarget((current) =>
        current && current.path === trashedPath ? null : current,
      );
      setCompareView((current) => {
        if (!current) return current;
        if (!current.caseKey.includes(trashedPath)) return current;
        return null;
      });
      try {
        await reloadWorkspaceParent(pending.parentPath);
      } catch {
        setStatus("Trashed; folder refresh failed");
        return;
      }
      setStatus(`Moved ${pending.name} to Trash`);
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Move to Trash failed");
    }
  }, [
    pendingTrash,
    reloadWorkspaceParent,
    setActiveTabId,
    setCompareAnchor,
    setCompareTarget,
    setCompareView,
    setGlobalError,
    setPendingDrafts,
    setRecentFiles,
    setStatus,
    setTabs,
    workspaceRootPath,
  ]);

  return {
    createFile,
    createFolder,
    focusIfAlreadyOpen,
    moveWorkspacePath,
    pendingRename,
    pendingRenameWarning: pendingRename?.warningKind ?? null,
    renameWorkspacePath,
    requestRename: setRenamingPath,
    renamingPath,
    confirmPendingRename,
    cancelPendingRename,
    pendingTrash,
    requestTrashWorkspacePath,
    confirmPendingTrash,
    cancelPendingTrash,
  };
}
