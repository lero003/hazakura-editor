/**
 * Start Panel first-use vs returning context (v1.9 Writing Loop Clarity).
 *
 * Returning mode surfaces the last workspace resume path and pathless
 * recovery candidates without inventing a second document model.
 */

import type { DraftRecord } from "../../types";
import { folderLabelFromPath } from "../../lib/utils";

export type StartPanelMode = "first-use" | "returning";

export type StartPanelReturningContext = {
  mode: StartPanelMode;
  /** Persisted workspace root still needing reopen (live root is empty). */
  resumeWorkspacePath: string | null;
  resumeWorkspaceLabel: string | null;
  pathlessDrafts: DraftRecord[];
  showResumeWorkspace: boolean;
  showRecovery: boolean;
};

export function resolveStartPanelReturningContext(options: {
  persistedWorkspaceRootPath: string | null | undefined;
  liveWorkspaceRootPath: string | null | undefined;
  pathlessDrafts: DraftRecord[];
}): StartPanelReturningContext {
  const pathlessDrafts = options.pathlessDrafts.filter(
    (draft) =>
      draft.path.length === 0 &&
      typeof draft.recoveryId === "string" &&
      draft.recoveryId.length > 0 &&
      draft.contents.length > 0,
  );

  const persisted =
    typeof options.persistedWorkspaceRootPath === "string" &&
    options.persistedWorkspaceRootPath.length > 0
      ? options.persistedWorkspaceRootPath
      : null;
  const live =
    typeof options.liveWorkspaceRootPath === "string" &&
    options.liveWorkspaceRootPath.length > 0
      ? options.liveWorkspaceRootPath
      : null;

  const showResumeWorkspace = persisted !== null && live === null;
  const showRecovery = pathlessDrafts.length > 0;
  const mode: StartPanelMode =
    showResumeWorkspace || showRecovery || live !== null
      ? "returning"
      : "first-use";

  return {
    mode,
    resumeWorkspacePath: showResumeWorkspace ? persisted : null,
    resumeWorkspaceLabel: showResumeWorkspace
      ? folderLabelFromPath(persisted)
      : null,
    pathlessDrafts,
    showResumeWorkspace,
    showRecovery,
  };
}
