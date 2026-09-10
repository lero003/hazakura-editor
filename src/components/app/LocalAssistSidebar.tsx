import { useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { AppleAssistProposalStatusEvent, AppleAssistTargetSnapshot, EditorTab, MenuLanguage } from "../../types";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import type { EditorPaneHandle } from "../editor/EditorPane";
import { getLocalAssistSidebarCopy } from "../../lib/locale/localAssistSidebar";
import { buildProposalEvent, getLocalAssistAction, LOCAL_ASSIST_VISIBLE_PRESET_IDS } from "../../lib/appleAssist/instruction";
import { cancelSidebarProposal, isLocalAssistBusy, requestSidebarProposal, subscribeLocalAssistActivity,
  subscribeSidebarApplyStatus, subscribeSidebarProposalStatus } from "../../lib/appleAssist/sidebarBridge";
import { buildSidebarTarget, countLocalAssistCharacters, type SidebarScope } from "../../features/editor/localAssistSidebarTarget";
import { beginSidebarTurn, createSidebarId, createSidebarSession, settleSidebarTurn, type SidebarSession } from "../../features/editor/localAssistSidebarSession";
import { localAssistReasonKey } from "../../features/editor/localAssistFailureReason";
import { readTargetTextForGeneration } from "../../features/editor/appleAssistText";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { useLocalAssistProposal } from "../../hooks/editor/useLocalAssistProposal";
import { LocalAssistProposalReview } from "./LocalAssistProposalReview";
import "../../styles/local-assist-sidebar.css";

type Props = {
  open: boolean; activeTab: EditorTab | null; tabs: readonly EditorTab[];
  editorPaneRef: RefObject<EditorPaneHandle | null>; menuLanguage: MenuLanguage; fontSize: number;
  availability?: AppleAssistAvailability; availabilityProbed?: boolean; textEditorVisible: boolean;
  onSelectTab: (tabId: string) => void; onOpenFile: () => unknown; onClose: () => void;
  onApply: (proposal: LocalAssistProposal) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDiscard: (proposal: LocalAssistProposal) => void;
};

/** Optional same-window control surface. The existing main handler is the only generator/writer. */
export function LocalAssistSidebar(props: Props) {
  const copy = getLocalAssistSidebarCopy(props.menuLanguage);
  const id = useId();
  const [sessions, setSessions] = useState(new Map<string, SidebarSession>());
  const sessionsRef = useRef(sessions);
  const [error, setError] = useState<{ sessionId: string; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLOListElement>(null);
  const followConversationRef = useRef(true);
  const sessionId = props.activeTab?.sessionId ?? "";
  const session = sessions.get(sessionId) ?? createSidebarSession();
  const busy = useSyncExternalStore(subscribeLocalAssistActivity, isLocalAssistBusy, () => false);
  const { proposal } = useLocalAssistProposal(sessionId || null);
  const available = props.availabilityProbed && props.availability?.kind === "available";
  const foreignProposal = !!proposal && proposal.conversationId !== session.conversationId;
  const missingProposal = session.nextTurn > 0 && !proposal && !session.pendingRequestId && !applying;
  const longProposal = !!proposal && !proposal.streaming && countLocalAssistCharacters(proposal.candidateText, 4000) > 4000;
  const currentTarget = !!session.target && !!props.activeTab && readTargetTextForGeneration(session.target, props.activeTab).ok;
  const latestProps = useRef(props);
  latestProps.current = props;

  function updateSession(key: string, update: (current: SidebarSession) => SidebarSession) {
    const current = sessionsRef.current.get(key) ?? createSidebarSession();
    const next = update(current);
    if (next === current) return;
    const updated = new Map(sessionsRef.current);
    updated.set(key, next);
    sessionsRef.current = updated;
    setSessions(updated);
  }
  useEffect(() => {
    const unsubscribeProposal = subscribeSidebarProposalStatus((status) => {
      for (const [key, current] of sessionsRef.current) {
        if (current.pendingRequestId === status.requestId) updateSession(key, (value) => settleSidebarTurn(value, status));
      }
    });
    const unsubscribeApply = subscribeSidebarApplyStatus((status) => {
      if (!status.conversationId || !(status.phase === "discarded" || (status.phase === "completed" && status.shouldApplyToDocument))) return;
      for (const [key, current] of sessionsRef.current) {
        if (current.conversationId !== status.conversationId) continue;
        updateSession(key, () => ({ ...createSidebarSession(), scope: current.scope,
          firstLine: current.firstLine, lastLine: current.lastLine,
          notice: status.phase === "discarded" ? "discarded" : "applied" }));
      }
    });
    return () => { unsubscribeProposal(); unsubscribeApply(); };
  }, []);
  useEffect(() => {
    const openSessions = new Set(props.tabs.map((tab) => tab.sessionId));
    const next = new Map([...sessionsRef.current].filter(([key]) => openSessions.has(key)));
    if (next.size !== sessionsRef.current.size) { sessionsRef.current = next; setSessions(next); }
  }, [props.tabs]);
  useEffect(() => { if (props.open) composerRef.current?.focus(); }, [props.open]);
  useEffect(() => { followConversationRef.current = true; }, [sessionId]);
  useEffect(() => {
    const log = conversationRef.current;
    if (log && props.open && followConversationRef.current) log.scrollTop = log.scrollHeight;
  }, [sessionId, session.turns.length, session.pendingRequestId, props.open]);

  function showError(text: string) { setError({ sessionId, text }); }
  function captureTarget(): AppleAssistTargetSnapshot | null {
    const tab = latestProps.current.activeTab;
    if (!tab || tab.sessionId !== sessionId || !latestProps.current.textEditorVisible) { showError(copy.editorChanged); return null; }
    const state = sessionsRef.current.get(sessionId) ?? createSidebarSession();
    if (state.target) {
      if (readTargetTextForGeneration(state.target, tab).ok) return state.target;
      showError(copy.targetChanged); return null;
    }
    const result = buildSidebarTarget({ document: tab, scope: state.scope, firstLine: state.firstLine, lastLine: state.lastLine,
      selection: props.editorPaneRef.current?.getActiveDocument() });
    if (!result.ok) {
      showError(result.error === "empty" ? copy.emptyTarget : copy[result.error]); return null;
    }
    const target = { ...result.target, label: `${result.firstLine}–${result.lastLine} ${copy.lineUnit} · ${result.characters} ${copy.chars}` };
    updateSession(sessionId, (current) => ({ ...current, target }));
    setError(null);
    return target;
  }
  function submit() {
    const tab = latestProps.current.activeTab;
    const state = sessionsRef.current.get(sessionId) ?? createSidebarSession();
    if (!tab || tab.sessionId !== sessionId || !available || isLocalAssistBusy() || state.pendingRequestId || applyingRef.current) return;
    const requestText = state.draft.trim();
    if (!requestText) return;
    if (countLocalAssistCharacters(requestText, 1000) > 1000) { showError(copy.requestLong); return; }
    const existing = localAssistProposalStore.getLatest(sessionId);
    if (existing && (existing.streaming || existing.conversationId !== state.conversationId)) { showError(copy.foreign); return; }
    if (state.nextTurn > 0 && !existing) { showError(copy.missingProposal); return; }
    if (existing && countLocalAssistCharacters(existing.candidateText, 4000) > 4000) { showError(copy.longProposal); return; }
    const target = captureTarget();
    if (!target) return;
    const payload = buildProposalEvent({ requestId: createSidebarId(), actionId: state.actionId,
      requestText, target, requestedAtMs: Date.now(), conversation: {
        conversationId: state.conversationId || createSidebarId(), turnIndex: state.nextTurn,
        originalText: target.text, proposalText: existing?.candidateText, revisionHistory: state.history,
      } });
    followConversationRef.current = true;
    updateSession(sessionId, (current) => beginSidebarTurn(current, payload));
    setConfirmReset(null); setError(null);
    if (!requestSidebarProposal(payload)) {
      const failed: AppleAssistProposalStatusEvent = { phase: "failed", requestId: payload.requestId,
        request: payload.request, message: copy.missingHandler, conversationId: payload.conversationId, emittedAtMs: Date.now() };
      updateSession(sessionId, (current) => settleSidebarTurn(current, failed));
      showError(copy.missingHandler);
    }
  }
  async function resetTarget() {
    if (isLocalAssistBusy() || applyingRef.current) return;
    const pending = localAssistProposalStore.getLatest(sessionId);
    if (pending) {
      // Use the same Discard callback as review. Do not clear another proposal.
      if (pending !== proposal || pending.streaming || foreignProposal) return;
      try { await props.onDiscard(pending); }
      catch { showError(copy.failed); return; }
      if (localAssistProposalStore.getLatest(sessionId)) { showError(copy.failed); return; }
    }
    if (latestProps.current.activeTab?.sessionId !== sessionId ||
        !latestProps.current.tabs.some((tab) => tab.sessionId === sessionId)) return;
    updateSession(sessionId, (current) => ({ ...createSidebarSession(), scope: current.scope,
      firstLine: current.firstLine, lastLine: current.lastLine, draft: current.draft }));
    setConfirmReset(null); setError(null);
  }
  async function apply(proposed: LocalAssistProposal) {
    if (applyingRef.current || isLocalAssistBusy()) return { ok: false as const, error: copy.pending };
    applyingRef.current = true; setApplying(true);
    try { return await props.onApply(proposed); }
    finally { applyingRef.current = false; setApplying(false); }
  }
  const controlsDisabled = busy || applying || !props.activeTab || !props.textEditorVisible;
  const lastTurnFailed = session.turns.length > 0 && session.turns[session.turns.length - 1].phase === "failed";
  const requestCharacters = countLocalAssistCharacters(session.draft);
  return (
    <aside hidden={!props.open} className="local-assist-sidebar" aria-label={copy.title}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation();
          if (confirmReset === sessionId) setConfirmReset(null); else props.onClose();
        }
      }}>
      <header className="local-assist-sidebar-header"><div><h2>{copy.title}</h2><p>{copy.model}</p></div>
        <button type="button" aria-label={copy.close} onClick={props.onClose}>×</button></header>
      <div className="local-assist-sidebar-body">
        <label htmlFor={`${id}-page`}>{copy.page}</label>
        <select id={`${id}-page`} value={props.activeTab?.id ?? ""} disabled={busy || applying} onChange={(event) => props.onSelectTab(event.target.value)}>
          {!props.activeTab ? <option value="">{copy.noPage}</option> : null}
          {props.tabs.map((tab) => <option key={tab.sessionId} value={tab.id}>{tab.name}</option>)}
        </select>
        <button type="button" disabled={busy || applying} onClick={() => { void props.onOpenFile(); }}>{copy.openPage}</button>
        {props.activeTab ? <p className="local-assist-sidebar-path">{props.activeTab.path || props.activeTab.name}</p> : null}
        <fieldset disabled={controlsDisabled || !!session.target || foreignProposal}>
          <legend>{copy.scope}</legend>
          {(["selection", "lines", "document"] as SidebarScope[]).map((scope) => <label key={scope} className="local-assist-sidebar-option">
            <input type="radio" name={`${id}-scope`} value={scope} checked={session.scope === scope}
              onChange={() => updateSession(sessionId, (value) => ({ ...value, scope }))} />{copy[scope]}</label>)}
          {session.scope === "lines" ? <div className="local-assist-sidebar-lines">
            <label>{copy.firstLine}<input inputMode="numeric" value={session.firstLine} onChange={(event) => updateSession(sessionId, (value) => ({ ...value, firstLine: event.target.value }))} /></label>
            <label>{copy.lastLine}<input inputMode="numeric" value={session.lastLine} onChange={(event) => updateSession(sessionId, (value) => ({ ...value, lastLine: event.target.value }))} /></label>
          </div> : null}
          <p>{session.scope === "lines" ? copy.lineHint : session.scope === "document" ? copy.documentHint : copy.selectionHint}</p>
          {!session.target ? <button type="button" onClick={captureTarget}>{copy.pin}</button> : null}
        </fieldset>
        {session.target ? <section aria-label={copy.pinned} className="local-assist-sidebar-target">
          <strong>{session.target.activeDocumentName} · {session.target.label}</strong>
          <details><summary>{copy.pinned}</summary><pre>{session.target.text}</pre></details>
          {!currentTarget ? <p role="status">{copy.targetChanged}</p> : null}
          <button type="button" disabled={controlsDisabled || foreignProposal} onClick={() => setConfirmReset(sessionId)}>{copy.reset}</button>
        </section> : null}
        {confirmReset === sessionId ? <section className="local-assist-sidebar-confirm" aria-label={copy.reset}>
          <p>{copy.resetQuestion}</p><button type="button" disabled={controlsDisabled} onClick={() => void resetTarget()}>{copy.confirmReset}</button>
          <button type="button" onClick={() => setConfirmReset(null)}>{copy.keep}</button></section> : null}
        <section aria-label={copy.chat}>
          <h3>{copy.chat}</h3>
          {session.turns.length ? <ol ref={conversationRef} className="local-assist-sidebar-conversation" aria-live="polite" aria-relevant="additions text"
            onScroll={(event) => { const log = event.currentTarget; followConversationRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 32; }}>{session.turns.map((turn) => {
            // 失敗は理由ごとに短い案内へ写す（生の内部文字列は出さない）。
            const reason = turn.phase === "failed" ? localAssistReasonKey(turn.message) : null;
            return <li key={turn.id}>
            <p>{turn.request}</p><small>{copy[turn.phase]}</small>
            {reason ? <p role="status" className="local-assist-sidebar-reason">{copy[reason]}</p> : null}</li>; })}</ol> : <p>{copy.empty}</p>}
          {session.notice ? <p role="status">{copy[session.notice]}</p> : null}
          {foreignProposal ? <p role="status">{copy.foreign}</p> : null}
          {missingProposal ? <p role="status">{copy.missingProposal}</p> : null}
          {longProposal ? <p role="status">{copy.longProposal}</p> : null}
        </section>
        <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="local-assist-sidebar-presets" role="group" aria-label={copy.presets}>
            {LOCAL_ASSIST_VISIBLE_PRESET_IDS.map((actionId) => { const action = getLocalAssistAction(actionId); return <button type="button" key={actionId}
              disabled={controlsDisabled || foreignProposal} onClick={() => { updateSession(sessionId, (value) => ({ ...value, actionId, draft: action.requestText })); composerRef.current?.focus(); }}>{action.label[props.menuLanguage]}</button>; })}
          </div>
          <label htmlFor={`${id}-request`}>{copy.composer}</label>
          <textarea ref={composerRef} id={`${id}-request`} value={session.draft} rows={4} placeholder={copy.placeholder}
            disabled={!props.activeTab || applying || foreignProposal} aria-describedby={`${id}-hint`}
            onChange={(event) => updateSession(sessionId, (value) => ({ ...value, draft: event.target.value, actionId: "rewrite_natural" }))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault(); event.stopPropagation(); submit();
              }
            }} />
          <p id={`${id}-hint`}>{copy.requestHint} {requestCharacters}/1,000 {copy.chars}</p>
          {error?.sessionId === sessionId ? <p role="alert">{error.text}</p> : null}
          {requestCharacters > 1000 ? <p role="alert">{copy.requestLong}</p> : null}
          {!available ? <p role="status">{props.availabilityProbed ? copy.unavailable : copy.checking}</p> : null}
          <div className="local-assist-sidebar-send">
            <button type="submit" disabled={controlsDisabled || !available || !session.draft.trim() || requestCharacters > 1000 || foreignProposal || missingProposal || longProposal || (!!session.target && !currentTarget)}>
              {proposal && !proposal.streaming ? copy.refine : copy.send}</button>
            {session.pendingRequestId ? <button type="button" onClick={() => void cancelSidebarProposal(session.pendingRequestId!)}>{copy.stop}</button> : null}
            {lastTurnFailed ? <button type="button" className="local-assist-sidebar-retry"
              disabled={controlsDisabled || !available || !session.draft.trim() || requestCharacters > 1000 || foreignProposal}
              onClick={() => submit()}>{copy.retry}</button> : null}
          </div>
          {busy ? <p role="status">{session.pendingRequestId ? copy.pending : copy.shuttingDown}</p> : null}
        </form>
        <LocalAssistProposalReview activeTab={props.open ? props.activeTab : null} menuLanguage={props.menuLanguage} fontSize={props.fontSize} blocked={busy || applying} onApply={apply} onDiscard={props.onDiscard} />
        <p className="local-assist-sidebar-privacy">{copy.privacy}</p>
      </div>
    </aside>
  );
}
