import type { RecentEntry } from "../../types";
import { buildRecentDisplayEntries } from "../../lib/utils";
import hazakuraMark from "../../assets/hazakura-mark.png";
import type { SafeEditorCopy } from "../../lib/locale/safeEditor";

export function StartPanel({
  copy,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFile,
  onTogglePinRecentFile,
  pinnedFiles,
  recentFiles,
}: {
  copy: SafeEditorCopy;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onOpenRecentFile: (path: string) => void;
  onTogglePinRecentFile: (path: string) => void;
  pinnedFiles: RecentEntry[];
  recentFiles: RecentEntry[];
}) {
  // The display list keeps recents that are not pinned, so the
  // pinned row does not also appear in the recents row. The
  // pinned list is sorted by `pinnedAt` desc (handled by
  // `buildRecentDisplayEntries` -> `recentEntryOrder`), and the
  // recents list by `openedAt` desc.
  const pinnedDisplay = buildRecentDisplayEntries(pinnedFiles);
  const pinnedPaths = new Set(pinnedFiles.map((entry) => entry.path));
  const visibleRecents = buildRecentDisplayEntries(
    recentFiles.filter((entry) => !pinnedPaths.has(entry.path)),
  ).slice(0, 4);
  const hasAnyRecent =
    pinnedDisplay.length > 0 || visibleRecents.length > 0;

  return (
    <div className="start-panel">
      <div className="start-panel-main">
        <div className="start-brand">
          <img className="start-logo" src={hazakuraMark} alt="" />
          <span className="start-kicker">hazakura editor</span>
        </div>
        <h1>{copy.startHeading}</h1>
        <div className="start-actions" aria-label={copy.startActions}>
          <button type="button" onClick={() => void onOpenFile()}>
            {copy.openFile}
          </button>
          <button type="button" onClick={() => void onOpenFolder()}>
            {copy.openFolder}
          </button>
          <button type="button" onClick={() => void onNewFile()}>
            {copy.newFile}
          </button>
        </div>
      </div>
      {hasAnyRecent ? (
        <div className="start-recent" aria-label={copy.recentFiles}>
          {pinnedDisplay.length > 0 ? (
            <div
              className="start-recent-group"
              aria-label={copy.pinnedFiles}
            >
              <span className="start-recent-group-label">
                {copy.pinnedFiles}
              </span>
              {pinnedDisplay.map((entry) => (
                <div className="start-recent-row" key={entry.path}>
                  <button
                    className="start-recent-chip pinned"
                    type="button"
                    onClick={() => onOpenRecentFile(entry.path)}
                    title={entry.path}
                  >
                    {entry.displayLabel}
                  </button>
                  <button
                    aria-label={copy.unpinFile}
                    className="start-recent-pin"
                    onClick={() => onTogglePinRecentFile(entry.path)}
                    title={copy.unpinFile}
                    type="button"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {visibleRecents.length > 0 ? (
            <div className="start-recent-group">
              <span className="start-recent-group-label">
                {copy.recentFiles}
              </span>
              {visibleRecents.map((entry) => (
                <div className="start-recent-row" key={entry.path}>
                  <button
                    className="start-recent-chip"
                    type="button"
                    onClick={() => onOpenRecentFile(entry.path)}
                    title={entry.path}
                  >
                    {entry.displayLabel}
                  </button>
                  <button
                    aria-label={copy.pinFile}
                    className="start-recent-pin"
                    onClick={() => onTogglePinRecentFile(entry.path)}
                    title={copy.pinFile}
                    type="button"
                  >
                    ☆
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
