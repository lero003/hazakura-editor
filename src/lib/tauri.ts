import { invoke } from "@tauri-apps/api/core";
import { confirm, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  getCurrentWindow,
  type CloseRequestedEvent,
  type Color,
  type Theme,
} from "@tauri-apps/api/window";
import type {
  EditableLineEnding,
  MenuLanguage,
  TextEncoding,
  ThemePreference,
} from "../types";

export type AppMenuRecentItem = {
  label: string;
};

export type AppMenuState = {
  hasActiveTab: boolean;
  activeDirty: boolean;
  previewVisible: boolean;
  wrapLines: boolean;
  showInvisibles: boolean;
  spellcheckEnabled: boolean;
  themePreference: ThemePreference;
  menuLanguage: MenuLanguage;
  recentFiles: AppMenuRecentItem[];
  recentFolders: AppMenuRecentItem[];
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
};

export type TextFileDocument = {
  path: string;
  name: string;
  contents: string;
  line_ending: EditableLineEnding;
  encoding: TextEncoding;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
  large_file_warning: boolean;
};

export type SavedFileState = {
  path: string;
  line_ending: EditableLineEnding;
  encoding: TextEncoding;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
};

export type FileMetadataState = {
  path: string;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
  large_file_warning: boolean;
};

export type WorkspaceTreeEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: WorkspaceTreeEntry[];
  children_loaded: boolean;
  children_truncated: boolean;
};

export type ImagePreviewDocument = {
  path: string;
  name: string;
  dataUrl: string;
  size: number;
};

export type AgentWorkbenchProvider = "codex" | "opencode" | "pi";

export type AgentWorkbenchPreflight = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerAvailable: boolean;
  providerPath: string | null;
  launchImplemented: boolean;
  searchedPaths: string[];
};

export type AgentWorkbenchSessionStatus = "active" | "stopped" | "exited";

export type AgentRuntimeStatus = "running" | "stopped" | "exited";

export type AgentRuntimeHandle = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerPath: string;
  status: AgentRuntimeStatus;
};

export type AgentWorkbenchOutputStream = "stdout" | "stderr" | "system";

export type AgentWorkbenchOutputChunk = {
  seq: number;
  stream: AgentWorkbenchOutputStream;
  text: string;
  receivedAtMs: number;
};

export type AgentWorkbenchSession = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerPath: string;
  createdAtMs: number;
  status: AgentWorkbenchSessionStatus;
  runtime: AgentRuntimeHandle;
};

export type AgentWorkbenchSessionStartResult = {
  preflight: AgentWorkbenchPreflight;
  session: AgentWorkbenchSession | null;
  output: AgentWorkbenchOutputChunk[];
};

export type AgentWorkbenchSessionState = {
  session: AgentWorkbenchSession | null;
  output: AgentWorkbenchOutputChunk[];
};

export const OPENED_FILES_EVENT = "hazakura-note://opened-files";

const TEXT_FILE_EXTENSIONS = [
  "md",
  "markdown",
  "mdown",
  "txt",
  "text",
  "log",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "toml",
  "csv",
  "tsv",
  "css",
  "html",
  "xml",
  "ini",
  "conf",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
];

const TEXT_FILE_FILTERS = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "mdown"],
  },
  {
    name: "Text",
    extensions: TEXT_FILE_EXTENSIONS,
  },
];

export async function pickMarkdownFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: TEXT_FILE_FILTERS,
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickNewMarkdownFilePath(
  defaultPath: string | null,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultPath ?? "untitled.md",
    filters: TEXT_FILE_FILTERS,
  });

  return typeof selected === "string"
    ? normalizeSelectedTextFilePath(selected)
    : null;
}

export async function pickSaveAsTextFilePath(
  defaultPath: string | null,
): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultPath ?? "untitled-copy.md",
    filters: TEXT_FILE_FILTERS,
  });

  return typeof selected === "string"
    ? normalizeSelectedTextFilePath(selected)
    : null;
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });

  return typeof selected === "string" ? selected : null;
}

export async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  return confirm(
    "The current file has unsaved changes. Discard them and open another file?",
    {
      title: "Unsaved changes",
      kind: "warning",
    },
  );
}

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWindow().close();
}

export async function requestAppRestart(): Promise<void> {
  if (!isTauriRuntime()) {
    window.location.reload();
    return;
  }

  await invoke("request_app_restart");
}

export async function setCurrentWindowTitle(title: string): Promise<void> {
  if (!isTauriRuntime()) {
    document.title = title;
    return;
  }

  await getCurrentWindow().setTitle(title);
}

export async function setCurrentWindowTheme(theme: Theme): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().setTheme(theme);
}

export async function setCurrentWindowBackgroundColor(
  color: Color,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().setBackgroundColor(color);
}

export async function onCurrentWindowCloseRequested(
  handler: (event: CloseRequestedEvent) => void | Promise<void>,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return getCurrentWindow().onCloseRequested(handler);
}

export async function openTextFile(path: string): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("open_text_file", { path });
}

export async function revealPathInFileManager(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("reveal_path_in_file_manager", { path });
}

export async function drainOpenedFiles(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<string[]>("drain_opened_files");
}

export async function createTextFile(path: string): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("create_text_file", { path });
}

export async function getFileMetadata(path: string): Promise<FileMetadataState> {
  return invoke<FileMetadataState>("get_file_metadata", { path });
}

export async function listWorkspaceTree(
  root: string,
): Promise<WorkspaceTreeEntry> {
  return invoke<WorkspaceTreeEntry>("list_workspace_tree", { root });
}

export async function listWorkspaceDirectory(
  root: string,
  directory: string,
): Promise<WorkspaceTreeEntry> {
  return invoke<WorkspaceTreeEntry>("list_workspace_directory", {
    root,
    directory,
  });
}

export async function openWorkspaceImage(
  root: string,
  path: string,
): Promise<ImagePreviewDocument> {
  return invoke<ImagePreviewDocument>("open_workspace_image", { root, path });
}

export async function savePastedImage(
  workspaceRoot: string,
  dataBase64: string,
  fileName: string,
): Promise<string> {
  return invoke<string>("save_pasted_image", {
    workspaceRoot,
    dataBase64,
    fileName,
  });
}

export async function importImageFromPath(
  workspaceRoot: string,
  sourcePath: string,
): Promise<string> {
  return invoke<string>("import_image_from_path", {
    workspaceRoot,
    sourcePath,
  });
}

export async function openTempPrintHtml(
  htmlContent: string,
  fileName: string,
): Promise<string> {
  return invoke<string>("open_temp_print_html", {
    htmlContent,
    fileName,
  });
}

export async function saveTextFile(
  path: string,
  contents: string,
  expectedFingerprint: string,
  lineEnding: EditableLineEnding,
  encoding: TextEncoding,
): Promise<SavedFileState> {
  return invoke<SavedFileState>("save_text_file", {
    path,
    contents,
    expectedFingerprint,
    lineEnding,
    encoding,
  });
}

export async function saveTextFileAs(
  path: string,
  contents: string,
  lineEnding: EditableLineEnding,
  encoding: TextEncoding,
): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("save_text_file_as", {
    path,
    contents,
    lineEnding,
    encoding,
  });
}

export type AutoBackupEntry = {
  path: string;
  name: string;
  modifiedAtMs: number;
  size: number;
};

export async function saveAutoBackup(
  workspaceRoot: string,
  relativeFilePath: string,
  content: string,
): Promise<string> {
  return invoke<string>("save_auto_backup", {
    workspaceRoot,
    relativeFilePath,
    content,
  });
}

export async function listAutoBackups(
  workspaceRoot: string,
  relativeFilePath: string,
): Promise<AutoBackupEntry[]> {
  return invoke<AutoBackupEntry[]>("list_auto_backups", {
    workspaceRoot,
    relativeFilePath,
  });
}

export async function readAutoBackup(
  workspaceRoot: string,
  relativeFilePath: string,
  backupName: string,
): Promise<string> {
  return invoke<string>("read_auto_backup", {
    workspaceRoot,
    relativeFilePath,
    backupName,
  });
}

export async function pruneAutoBackups(
  workspaceRoot: string,
  relativeFilePath: string,
  keepCount: number,
): Promise<number> {
  return invoke<number>("prune_auto_backups", {
    workspaceRoot,
    relativeFilePath,
    keepCount,
  });
}

export async function startAgentWorkbenchSession(
  agentWorkbenchEnabled: boolean,
  consentAcknowledged: boolean,
  provider: AgentWorkbenchProvider,
  workspaceRoot: string,
  terminalColumns?: number,
  terminalRows?: number,
): Promise<AgentWorkbenchSessionStartResult> {
  return invoke<AgentWorkbenchSessionStartResult>("start_agent_workbench_session", {
    agentWorkbenchEnabled,
    consentAcknowledged,
    provider,
    workspaceRoot,
    terminalColumns,
    terminalRows,
  });
}

export async function stopAgentWorkbenchSession(): Promise<AgentWorkbenchSessionState> {
  return invoke<AgentWorkbenchSessionState>("stop_agent_workbench_session");
}

export async function getAgentWorkbenchSessionState(
  lastSeenSeq?: number,
): Promise<AgentWorkbenchSessionState> {
  if (!isTauriRuntime()) {
    return { session: null, output: [] };
  }

  return invoke<AgentWorkbenchSessionState>(
    "get_agent_workbench_session_state",
    lastSeenSeq !== undefined ? { lastSeenSeq } : undefined,
  );
}

export async function writeAgentWorkbenchSessionInput(
  input: string,
): Promise<void> {
  return invoke<void>("write_agent_workbench_session_input", {
    input,
  });
}

export async function resizeAgentWorkbenchTerminal(
  columns: number,
  rows: number,
): Promise<AgentWorkbenchSessionState> {
  return invoke<AgentWorkbenchSessionState>("resize_agent_workbench_terminal", {
    columns,
    rows,
  });
}

export async function updateAppMenuState(state: AppMenuState): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("update_app_menu_state", { state });
}

export async function openAgentWindow(theme?: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("open_agent_window", { theme: theme ?? null });
  } catch (err) {
    console.warn("Failed to open Agent window", err);
  }
}

// Reverse link from the detached Agent window's "Show in main pane"
// footer button. The Rust side gates this to the main|agent labels and
// emits OPEN_MAIN_AGENT_PANE_EVENT to the main window; the main
// window's useMainAgentPaneFocus hook flips the right pane to Agent.
// We only need to fire the invoke; the response payload is empty.
export async function openMainAgentPane(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("open_main_agent_pane");
  } catch (err) {
    console.warn("Failed to open main Agent pane", err);
  }
}

// Cross-window workspace bridge: the main window writes the active
// workspace path on open / close via setMainActiveWorkspace, and the
// detached agent window reads it on mount via getMainActiveWorkspace.
// The agent window also subscribes to MAIN_WORKSPACE_CHANGED_EVENT
// (see src/hooks/agent/useMainWindowWorkspace.ts) so live open /
// close in the main window pushes into the agent window within the
// event round-trip — no polling needed.
export async function getMainActiveWorkspace(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const result = await invoke<string | null>("get_main_active_workspace");
    return result ?? null;
  } catch (err) {
    console.warn("Failed to read main active workspace", err);
    return null;
  }
}

export async function setMainActiveWorkspace(
  workspace: string | null,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_main_active_workspace", { workspace });
  } catch (err) {
    console.warn("Failed to set main active workspace", err);
  }
}

export async function setAgentWindowTheme(theme: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_agent_window_theme", { theme });
  } catch (err) {
    console.warn("Failed to set Agent window theme", err);
  }
}

export async function updateThemeMenuState(
  themePreference: string,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("update_theme_menu_state", { themePreference });
}

function normalizeSelectedTextFilePath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex === -1 ? "" : path.slice(0, slashIndex + 1);
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  const segments = fileName.split(".");

  if (segments.length < 3) {
    return path;
  }

  const finalExtension = segments.at(-1)?.toLowerCase() ?? "";
  const typedExtension = segments.at(-2)?.toLowerCase() ?? "";

  if (
    TEXT_FILE_EXTENSIONS.includes(finalExtension) &&
    TEXT_FILE_EXTENSIONS.includes(typedExtension)
  ) {
    return `${directory}${segments.slice(0, -1).join(".")}`;
  }

  return path;
}

export function isTauriRuntime(): boolean {
  return Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}
