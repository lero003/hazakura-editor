// v0.17 diagnostics-ui slice.
//
// Thin React wrapper around `collectDiagnostics()` so the
// diagnostics pane always renders a snapshot that goes
// through the existing privacy-preserving helper. The
// helper already strips document contents, workspace
// paths, and secret-looking values (see
// `lib/diagnostics.ts` and its tests), so this hook only
// needs to wire the live editor settings into the helper.
//
// Recent error category history is intentionally left as
// an empty list: the app does not yet keep a bounded,
// sanitised error log on the frontend, and shipping a
// diagnostics pane that always shows "no recent errors"
// is honest until such a log exists. When that store
// lands, this hook is the single place to add it without
// touching the pane or the helper.

import { useMemo } from "react";
import {
  collectDiagnostics,
  type DiagnosticsSnapshot,
} from "../../lib/diagnostics";

export type UseDiagnosticsSnapshotOptions = {
  appleLocalAssistAvailable: boolean;
  autoBackupEnabled: boolean;
  lModeEnabled: boolean;
  wrapLines: boolean;
  theme: string;
};

export function useDiagnosticsSnapshot(
  options: UseDiagnosticsSnapshotOptions,
  refreshToken?: number,
): DiagnosticsSnapshot {
  return useMemo<DiagnosticsSnapshot>(
    () =>
      collectDiagnostics({
        appleLocalAssistAvailable: options.appleLocalAssistAvailable,
        autoBackupEnabled: options.autoBackupEnabled,
        lModeEnabled: options.lModeEnabled,
        wrapLines: options.wrapLines,
        theme: options.theme,
        recentErrorCategories: [],
      }),
    [
      options.appleLocalAssistAvailable,
      options.autoBackupEnabled,
      options.lModeEnabled,
      options.wrapLines,
      options.theme,
      refreshToken,
    ],
  );
}
