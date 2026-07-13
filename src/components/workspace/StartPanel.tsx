import { useMemo } from "react";
import hazakuraMark from "../../assets/hazakura-mark.png";
import { draftStorageKey } from "../../features/document/pathlessDraftRecovery";
import { resolveStartPanelReturningContext } from "../../features/workspace/startPanelReturning";
import { readPersistedWorkspaceState } from "../../lib/storage";
import type { RecoveryCopy, SafeEditorCopy } from "../../lib/locale";
import type { DraftRecord } from "../../types";

export function StartPanel({
  copy,
  liveWorkspaceRootPath = null,
  onDiscardDraft,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onReopenPersistedWorkspace,
  onRestoreDraft,
  pathlessDrafts = [],
  /** Test override for the last workspace root; live app reads storage. */
  persistedWorkspaceRootPath,
  recoveryCopy,
}: {
  copy: SafeEditorCopy;
  liveWorkspaceRootPath?: string | null;
  onDiscardDraft?: (draftPathOrKey: string) => void;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  onReopenPersistedWorkspace?: () => void | Promise<void>;
  onRestoreDraft?: (draft: DraftRecord) => void;
  pathlessDrafts?: DraftRecord[];
  persistedWorkspaceRootPath?: string | null;
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

  const heading =
    returning.mode === "returning"
      ? copy.startHeadingReturning
      : copy.startHeading;

  return (
    <div
      className="start-panel"
      data-start-mode={returning.mode}
      data-testid="start-panel"
    >
      <div className="start-panel-main">
        <div className="start-brand">
          <img className="start-logo" src={hazakuraMark} alt="" />
          <span className="start-kicker">Hazakura Editor</span>
        </div>
        <h1>{heading}</h1>
        <p className="start-value-pitch">{copy.startValuePitch}</p>
        <ul className="start-purpose-hints" aria-label={copy.startValuePitch}>
          <li>{copy.startHintWrite}</li>
          <li>{copy.startHintRead}</li>
          <li>{copy.startHintVerify}</li>
        </ul>

        {returning.showResumeWorkspace &&
        returning.resumeWorkspaceLabel &&
        onReopenPersistedWorkspace ? (
          <section
            className="start-resume-section"
            aria-label={copy.startResumeSection}
          >
            <h2 className="start-section-heading">{copy.startResumeSection}</h2>
            <p className="start-section-hint">{copy.startResumeWorkspaceHint}</p>
            <div className="start-actions start-actions-primary">
              <button
                type="button"
                className="start-resume-button"
                onClick={() => void onReopenPersistedWorkspace()}
              >
                {copy.startResumeWorkspace(returning.resumeWorkspaceLabel)}
              </button>
            </div>
          </section>
        ) : null}

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
                        onClick={() => onDiscardDraft(key)}
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
    </div>
  );
}
