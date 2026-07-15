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
