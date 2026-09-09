import { useEffect, useRef, useState, type RefObject } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { EditorTab } from "../../types";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import { isProposalCurrentForDocument } from "../../features/editor/proposalReview";
import { LOCAL_ASSIST_REVIEW_REQUEST_EVENT, LOCAL_ASSIST_REVIEW_RESULT_EVENT, matchesReviewIdentity,
  type LocalAssistReviewIdentity } from "../../features/editor/localAssistReviewIdentity";
import { focusMainLocalAssistReview } from "../../lib/tauri/localAssistReview";

export function resolveReviewTab(identity: LocalAssistReviewIdentity, tabs: EditorTab[]): EditorTab | null {
  const tab = tabs.find((entry) => entry.sessionId === identity.documentSessionId);
  const proposal = tab && localAssistProposalStore.getLatest(tab.sessionId);
  if (!tab || !proposal || !matchesReviewIdentity(identity, {
    requestId: proposal.requestId, conversationId: proposal.conversationId,
    documentSessionId: proposal.target.activeDocumentSessionId,
  }) || !isProposalCurrentForDocument(proposal, tab)) return null;
  return tab;
}

type Options = { tabs: EditorTab[]; activeTab: EditorTab | null; blocked: boolean;
  onSelectTab: (id: string) => void; hostRef: RefObject<HTMLDivElement | null> };

/** Navigation only. Both before selecting and after rendering, main checks its own store. */
export function useLocalAssistReviewNavigation(options: Options): void {
  const current = useRef(options);
  current.current = options;
  const [pending, setPending] = useState<LocalAssistReviewIdentity | null>(null);
  const pendingRef = useRef<LocalAssistReviewIdentity | null>(null);
  const blocked = () => current.current.blocked || !!document.querySelector('[aria-modal="true"]');
  const reply = (identity: LocalAssistReviewIdentity, accepted: boolean) => {
    void emitTo("apple-assist", LOCAL_ASSIST_REVIEW_RESULT_EVENT, { ...identity, accepted })
      .catch((error) => console.warn("Cannot report Local Assist review navigation", error));
  };

  useEffect(() => {
    let disposed = false;
    const subscription = listen<LocalAssistReviewIdentity>(LOCAL_ASSIST_REVIEW_REQUEST_EVENT, ({ payload }) => {
      if (disposed) return;
      const tab = resolveReviewTab(payload, current.current.tabs);
      if (blocked() || !tab || pendingRef.current) { reply(payload, false); return; }
      pendingRef.current = payload;
      setPending(payload);
      current.current.onSelectTab(tab.id);
    }).catch(() => null); // Browser preview has no native event transport.
    return () => { disposed = true; void subscription.then((unlisten) => unlisten?.()); };
  }, []);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const finish = (accepted: boolean) => {
      if (cancelled) return;
      pendingRef.current = null;
      setPending(null);
      reply(pending, accepted);
    };
    const tab = resolveReviewTab(pending, options.tabs);
    if (blocked() || !tab) { finish(false); return; }
    // A guarded tab selection may be refused; do not focus the previous tab.
    if (options.activeTab?.sessionId !== tab.sessionId) {
      const timer = setTimeout(() => finish(false), 1500);
      return () => { cancelled = true; clearTimeout(timer); };
    }
    const region = options.hostRef.current?.querySelector<HTMLElement>('[data-review-request-id]');
    if (!region || region.dataset.reviewRequestId !== pending.requestId) { finish(false); return; }
    void focusMainLocalAssistReview().then(() => {
      if (cancelled) return;
      if (blocked() || current.current.activeTab?.sessionId !== pending.documentSessionId ||
          !resolveReviewTab(pending, current.current.tabs) || !region.isConnected ||
          region.dataset.reviewRequestId !== pending.requestId) { finish(false); return; }
      region.focus();
      finish(document.activeElement === region);
    }).catch(() => finish(false));
    return () => { cancelled = true; };
  }, [pending, options.activeTab, options.tabs, options.blocked, options.hostRef]);
}
