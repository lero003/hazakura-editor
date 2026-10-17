import type { WorkspaceSidebarProps } from "../../components/workspace/WorkspaceSidebar";

type P = WorkspaceSidebarProps;
type PathLike = { path?: string | null } | null | undefined;

/**
 * Values the two WorkspaceSidebar call sites can supply under the same name:
 * the workspace column in `AppWorkspace` and the L Mode rail in `AppShell`
 * both read them from their own props (plus a shared `workspaceTabMarkers`).
 *
 * Types are borrowed from the sidebar's own props wherever the value is passed
 * through unchanged, so a sidebar API change surfaces here once.
 */
export type WorkspaceSidebarSource = {
  activeTab: PathLike;
  bookScopeChapterRelativePaths?: P["bookScopeChapterRelativePaths"];
  bookScopeChapters?: P["bookScopeChapters"];
  bookScopeNodes?: P["bookScopeNodes"];
  bookScopeResolving?: P["bookScopeResolving"];
  bookScopeSuggesting?: P["bookScopeSuggesting"];
  bookScopeSuggestionError?: P["bookScopeSuggestionError"];
  bookScopeUnavailable?: P["bookScopeUnavailable"];
  cancelBookScopeSuggestion?: P["onCancelBookScopeSuggestion"];
  clearCompareSource: () => void;
  clearCompareTarget: () => void;
  commitBookScopeNodes?: P["onCommitBookScope"];
  compareAnchor: PathLike;
  compareTarget: PathLike;
  createBookScopeSuggestion?: P["onCreateBookScopeSuggestion"];
  createFile: (root: string) => unknown;
  createFolder: (root: string) => unknown;
  createOkfScaffoldAt: (root: string, template: "minimal" | "book-like") => unknown;
  exportBookRecipe?: P["onExportBookRecipe"];
  fileOpsCopy: P["fileOpsCopy"];
  importBookRecipeDraft?: P["onImportBookRecipeDraft"];
  loadWorkspaceDirectory: P["onLoadDirectory"];
  menuLanguage?: P["menuLanguage"];
  onMoveEntry: P["onMoveEntry"];
  onMoveToTrash: P["onMoveToTrash"];
  onOpenGlobalSearch?: P["onOpenGlobalSearch"];
  onRefreshWorkspace?: P["onRefreshWorkspace"];
  onSubmitRename: P["onSubmitRename"];
  onWorkspaceDirectoryExpanded?: P["onWorkspaceDirectoryExpanded"];
  onWorkspaceTreeVisibilityChange?: P["onWorkspaceTreeVisibilityChange"];
  openRootWorkspaceContextMenu: P["onOpenRootContextMenu"];
  openWorkspace: () => unknown;
  openWorkspaceContextMenu: P["onOpenContextMenu"];
  openWorkspaceFile: (path: string) => unknown;
  renamingPath: P["renamingPath"];
  requestRename: P["requestRename"];
  revalidateBookScope?: P["onRevalidateBookScope"];
  safeEditorCopy: P["copy"];
  selectWorkspaceCompareFile: P["onSelectCompareFile"];
  selectedImage: PathLike;
  sidePaneMode: string | null;
  workspaceRootPath: P["workspaceRootPath"];
  workspaceTabMarkers: {
    dirtyFilePaths: P["dirtyFilePaths"];
    openFilePaths: P["openFilePaths"];
  };
  workspaceTree: P["workspaceTree"];
};

/** Values only one of the two call sites has (L Mode rail / reader). */
export type WorkspaceSidebarExtras = {
  bookScopeReaderLoading?: P["bookScopeReaderLoading"];
  onCollapse?: P["onCollapse"];
  onReadBookScope?: P["onReadBookScope"];
  onReviewChapterChanges?: P["onReviewChapterChanges"];
  treeVisible?: P["treeVisible"];
};

/**
 * Maps the shared source + per-site extras onto the sidebar's props.
 *
 * Both call sites previously spelled these 45 entries out separately; the two
 * copies had to be kept in sync by hand whenever the sidebar's API changed.
 * Values and wrapper semantics are unchanged (the workspace-root guarded
 * create actions and the compare-selection clearer are still created per
 * render, as before).
 */
export function buildWorkspaceSidebarProps(
  source: WorkspaceSidebarSource,
  extras: WorkspaceSidebarExtras = {},
): WorkspaceSidebarProps {
  const runAtWorkspaceRoot =
    (run: (root: string) => unknown) => (): void => {
      if (source.workspaceRootPath) {
        void run(source.workspaceRootPath);
      }
    };

  return {
    activePath: source.selectedImage?.path ?? source.activeTab?.path ?? null,
    bookScopeChapterRelativePaths: source.bookScopeChapterRelativePaths,
    bookScopeChapters: source.bookScopeChapters,
    bookScopeNodes: source.bookScopeNodes,
    bookScopeReaderLoading: extras.bookScopeReaderLoading,
    bookScopeResolving: source.bookScopeResolving,
    bookScopeSuggesting: source.bookScopeSuggesting,
    bookScopeSuggestionError: source.bookScopeSuggestionError,
    bookScopeUnavailable: source.bookScopeUnavailable,
    compareSelectionEnabled: source.sidePaneMode === "compare",
    compareSourcePath: source.compareAnchor?.path ?? null,
    compareTargetPath: source.compareTarget?.path ?? null,
    copy: source.safeEditorCopy,
    dirtyFilePaths: source.workspaceTabMarkers.dirtyFilePaths,
    fileOpsCopy: source.fileOpsCopy,
    menuLanguage: source.menuLanguage,
    onCancelBookScopeSuggestion: source.cancelBookScopeSuggestion,
    onClearCompareSelection: () => {
      source.clearCompareSource();
      source.clearCompareTarget();
    },
    onCollapse: extras.onCollapse,
    onCommitBookScope: source.commitBookScopeNodes,
    onCreateBookScopeSuggestion: source.createBookScopeSuggestion,
    onCreateFile: runAtWorkspaceRoot(source.createFile),
    onCreateFolder: runAtWorkspaceRoot(source.createFolder),
    onCreateOkfScaffoldBookLike: runAtWorkspaceRoot((root) =>
      source.createOkfScaffoldAt(root, "book-like"),
    ),
    onCreateOkfScaffoldMinimal: runAtWorkspaceRoot((root) =>
      source.createOkfScaffoldAt(root, "minimal"),
    ),
    onExportBookRecipe: source.exportBookRecipe,
    onImportBookRecipeDraft: source.importBookRecipeDraft,
    onLoadDirectory: source.loadWorkspaceDirectory,
    onMoveEntry: source.onMoveEntry,
    onMoveToTrash: source.onMoveToTrash,
    onOpenContextMenu: source.openWorkspaceContextMenu,
    onOpenFile: (path) => void source.openWorkspaceFile(path),
    onOpenGlobalSearch: source.onOpenGlobalSearch,
    onOpenRootContextMenu: source.openRootWorkspaceContextMenu,
    onOpenWorkspace: () => void source.openWorkspace(),
    onReadBookScope: extras.onReadBookScope,
    onRefreshWorkspace: source.onRefreshWorkspace,
    onRevalidateBookScope: source.revalidateBookScope,
    onReviewChapterChanges: extras.onReviewChapterChanges,
    onSelectCompareFile: source.selectWorkspaceCompareFile,
    onSubmitRename: source.onSubmitRename,
    onWorkspaceDirectoryExpanded: source.onWorkspaceDirectoryExpanded,
    onWorkspaceTreeVisibilityChange: source.onWorkspaceTreeVisibilityChange,
    openFilePaths: source.workspaceTabMarkers.openFilePaths,
    renamingPath: source.renamingPath,
    requestRename: source.requestRename,
    treeVisible: extras.treeVisible,
    workspaceRootPath: source.workspaceRootPath,
    workspaceTree: source.workspaceTree,
  };
}
