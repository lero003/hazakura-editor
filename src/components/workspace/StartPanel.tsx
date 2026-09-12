import { useMemo } from "react";
import hazakuraMark from "../../assets/hazakura-mark.png";
import { draftStorageKey } from "../../features/document/pathlessDraftRecovery";
import { formatRecentOpenedAt } from "../../features/workspace/recentOpenedAtLabel";
import { resolveStartPanelReturningContext } from "../../features/workspace/startPanelReturning";
import { readPersistedWorkspaceState } from "../../lib/storage";
import type { RecoveryCopy, SafeEditorCopy } from "../../lib/locale";
import { buildRecentDisplayEntries } from "../../lib/utils";
import type { DraftRecord, MenuLanguage, RecentEntry } from "../../types";

/** Visible cap on Start Panel (storage may keep more for the OS menu). */
export const START_PANEL_RECENT_WORKSPACES_LIMIT = 5;

/** 開始画面の行に出す補足パス。名前を優先し、末尾の要素は落とす。 */
function parentFolderPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const slashIndex = trimmed.lastIndexOf("/");
  return slashIndex > 0 ? trimmed.slice(0, slashIndex) : trimmed;
}

export function StartPanel({
  copy,
  language = "en",
  liveWorkspaceRootPath = null,
  onDiscardDraft,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentWorkspace,
  onReopenPersistedWorkspace,
  onRestoreDraft,
  pathlessDrafts = [],
  /** Test override for the last workspace root; live app reads storage. */
  persistedWorkspaceRootPath,
  recentWorkspaces = [],
  recoveryCopy,
}: {
  copy: SafeEditorCopy;
  /** 最近開いたフォルダの日時ラベルに使う。表示文言は copy 側が正本。 */
  language?: MenuLanguage;
  liveWorkspaceRootPath?: string | null;
  onDiscardDraft?: (draftPathOrKey: string) => void;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onOpenRecentWorkspace?: (path: string) => void | Promise<void>;
  onReopenPersistedWorkspace?: () => void | Promise<void>;
  onRestoreDraft?: (draft: DraftRecord) => void;
  pathlessDrafts?: DraftRecord[];
  persistedWorkspaceRootPath?: string | null;
  recentWorkspaces?: RecentEntry[];
  recoveryCopy?: RecoveryCopy;
}) {
  const resolvedPersistedRoot =
    persistedWorkspaceRootPath !== undefined
      ? persistedWorkspaceRootPath
      : (readPersistedWorkspaceState()?.workspaceRootPath ?? null);

  const returning = useMemo(
    () =>
      resolveStartPanelReturningContext({
        persistedWorkspaceRootPath: resolvedPersistedRoot,
        liveWorkspaceRootPath,
        pathlessDrafts,
      }),
    [liveWorkspaceRootPath, pathlessDrafts, resolvedPersistedRoot],
  );

  const recentWorkspaceRows = useMemo(() => {
    const live = liveWorkspaceRootPath ?? "";
    const resumePath = returning.resumeWorkspacePath;
    const filtered = recentWorkspaces.filter((entry) => {
      if (!entry.path) return false;
      if (live && entry.path === live) return false;
      // Primary resume control already covers this path.
      if (resumePath && entry.path === resumePath) return false;
      return true;
    });
    return buildRecentDisplayEntries(filtered).slice(
      0,
      START_PANEL_RECENT_WORKSPACES_LIMIT,
    );
  }, [
    liveWorkspaceRootPath,
    recentWorkspaces,
    returning.resumeWorkspacePath,
  ]);

  const heading =
    returning.mode === "returning" || recentWorkspaceRows.length > 0
      ? copy.startHeadingReturning
      : copy.startHeading;

  const resumeButton =
    returning.showResumeWorkspace &&
    returning.resumeWorkspaceLabel &&
    onReopenPersistedWorkspace ? (
      <section
        className="start-resume-section"
        aria-label={copy.startResumeSection}
      >
        <div className="start-actions start-actions-primary">
          <button
            type="button"
            className="start-resume-button"
            autoFocus
            aria-label={copy.startResumeWorkspace(returning.resumeWorkspaceLabel)}
            onClick={() => void onReopenPersistedWorkspace()}
          >
            {returning.resumeWorkspaceLabel}
          </button>
        </div>
      </section>
    ) : null;

  const startActions = (
    <div
      className={`start-actions${
        resumeButton ? " start-actions-secondary" : ""
      }`}
      aria-label={copy.startActions}
    >
      <button
        type="button"
        className="start-open-folder"
        autoFocus={!liveWorkspaceRootPath && !resumeButton}
        onClick={() => void onOpenFolder()}
      >
        {copy.openFolder}
      </button>
      <button type="button" onClick={() => void onNewFile()}>
        {copy.newFile}
      </button>
      <button type="button" onClick={() => void onOpenFile()}>
        {copy.openFile}
      </button>
    </div>
  );

  return (
    <div
      className="start-panel"
      data-start-mode={returning.mode}
      data-testid="start-panel"
    >
      {/* 左: 静かなブランド面。大きなコピーと開始操作を置く（画面01）。 */}
      <section className="start-panel-intro">
        <div className="start-brand">
          <img className="start-logo" src={hazakuraMark} alt="" />
          <span className="start-kicker">Hazakura Editor</span>
        </div>
        <h1 className="start-heading">{heading}</h1>
        <p className="start-value-pitch">{copy.startValuePitch}</p>
        {resumeButton}
        {startActions}
        {/* 画面01: ファイルの在りかを一言で示す（モックの盾つき一行）。 */}
        <p className="start-local-note">
          <span aria-hidden="true" className="start-local-note-icon">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
            </svg>
          </span>
          {copy.startLocalNote}
        </p>
      </section>

      {/* 右: 続きから書く面。最近のフォルダと復旧候補。 */}
      <div className="start-panel-main">
        <section
          className="start-recent-section"
          aria-label={copy.startRecentWorkspacesSection}
          data-testid="start-panel-recent-workspaces"
        >
          <h2 className="start-section-heading">
            {copy.startRecentWorkspacesSection}
          </h2>
          {recentWorkspaceRows.length > 0 && onOpenRecentWorkspace ? (
            <ul className="start-recent-list">
              {recentWorkspaceRows.map((entry) => {
                const when = formatRecentOpenedAt(
                  entry.openedAt,
                  language,
                  Date.now(),
                );
                return (
                  <li key={entry.path}>
                    <button
                      type="button"
                      className="start-recent-button"
                      aria-label={copy.startOpenRecentWorkspace(
                        entry.displayLabel,
                      )}
                      title={entry.path}
                      onClick={() => void onOpenRecentWorkspace(entry.path)}
                    >
                      <span className="start-recent-mark" aria-hidden="true" />
                      <span className="start-recent-copy">
                        <strong className="start-recent-name">
                          {entry.displayLabel}
                        </strong>
                        <small className="start-recent-path">
                          {parentFolderPath(entry.path)}
                        </small>
                      </span>
                      {when ? (
                        <span className="start-recent-when">{when}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="start-recent-empty">{copy.startRecentEmpty}</p>
          )}
        </section>

        {returning.showRecovery &&
        recoveryCopy &&
        onRestoreDraft &&
        onDiscardDraft ? (
          <section
            className="start-recovery-section"
            aria-label={copy.startRecoverySection}
            data-testid="start-panel-recovery"
          >
            <h2 className="start-section-heading">
              {copy.startRecoveryHeading}
            </h2>
            <ul className="start-recovery-list">
              {returning.pathlessDrafts.map((draft) => {
                const label =
                  draft.name?.trim() || recoveryCopy.pathlessDraftFallbackName;
                const key = draftStorageKey(draft);
                return (
                  <li className="start-recovery-item" key={key}>
                    <div className="start-recovery-copy">
                      <span className="start-recovery-name">{label}</span>
                      <span className="start-recovery-detail">
                        {recoveryCopy.pathlessDraftDetail}
                      </span>
                    </div>
                    <div
                      className="start-recovery-actions"
                      aria-label={recoveryCopy.draftActions}
                    >
                      <button
                        type="button"
                        onClick={() => onRestoreDraft(draft)}
                      >
                        {recoveryCopy.restoreDraft}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(recoveryCopy.discardDraftConfirm)) {
                            onDiscardDraft(key);
                          }
                        }}
                      >
                        {recoveryCopy.discardDraft}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
