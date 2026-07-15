import { invoke } from "@tauri-apps/api/core";

export type OkfDiscoveryFile = {
  path: string;
  relativePath: string;
  content: string | null;
  byteLength: number;
  unreadableReason: string | null;
};

export type OkfDiscoveryResult = {
  bundleRoot: string;
  files: OkfDiscoveryFile[];
  scannedEntries: number;
  scannedMarkdownFiles: number;
  totalBytesRead: number;
  truncated: boolean;
  truncationReason: string | null;
  cancelled: boolean;
  source: "disk";
};

/**
 * Explicit, main-window-only OKF disk snapshot. Does not interpret YAML.
 */
export async function scanOkfBundle(
  workspaceRoot: string,
  bundleRoot: string,
): Promise<OkfDiscoveryResult> {
  return invoke<OkfDiscoveryResult>("scan_okf_bundle", {
    workspaceRoot,
    bundleRoot,
  });
}

export async function cancelOkfBundleScan(): Promise<boolean> {
  return invoke<boolean>("cancel_okf_bundle_scan");
}

export type OkfScaffoldFileInput = {
  relativePath: string;
  contents: string;
};

export type OkfScaffoldResult = {
  rootPath: string;
  createdFiles: string[];
  openPath: string | null;
};

/**
 * Create a new folder under parentPath and write fixed scaffold files.
 * Main-window only; refuses overwrites and path escape.
 */
export async function createOkfScaffold(options: {
  workspaceRoot: string;
  parentPath: string;
  folderName: string;
  files: OkfScaffoldFileInput[];
  openRelativePath?: string | null;
}): Promise<OkfScaffoldResult> {
  return invoke<OkfScaffoldResult>("create_okf_scaffold", {
    workspaceRoot: options.workspaceRoot,
    parentPath: options.parentPath,
    folderName: options.folderName,
    files: options.files,
    openRelativePath: options.openRelativePath ?? null,
  });
}
