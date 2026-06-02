import { invoke } from "@tauri-apps/api/core";

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
