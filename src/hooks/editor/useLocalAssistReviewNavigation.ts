import { useEffect, useRef, useState, type RefObject } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { EditorTab } from "../../types";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import { isProposalCurrentForDocument } from "../../features/editor/proposalReview";
import { LOCAL_ASSIST_REVIEW_REQUEST_EVENT, LOCAL_ASSIST_REVIEW_RESULT_EVENT, matchesReviewIdentity,
  type LocalAssistReviewIdentity, type LocalAssistReviewRequest } from "../../features/editor/localAssistReviewIdentity";
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
  onSelectTab: (id: string) => void; hostRef: RefObject<HTMLDivElement | null>;
  /** 本文領域を見える状態にする（狭幅のcompact/参照表示を畳む）。07 P2。 */
  onRevealRegion?: () => void; };

/** Navigation only. Both before selecting and after rendering, main checks its own store. */
export function useLocalAssistReviewNavigation(options: Options): void {
  const current = useRef(options);
  current.current = options;
  const [pending, setPending] = useState<LocalAssistReviewRequest | null>(null);
  const pendingRef = useRef<{ request: LocalAssistReviewRequest; expiresAt: number;
    timer: ReturnType<typeof setTimeout>; focusStarted: boolean } | null>(null);
  const blocked = () => current.current.blocked || !!document.querySelector('[aria-modal="true"]');
  const reply = (request: LocalAssistReviewRequest, accepted: boolean) => {
    void emitTo("apple-assist", LOCAL_ASSIST_REVIEW_RESULT_EVENT, { ...request, accepted })
      .catch((error) => console.warn("Cannot report Local Assist review navigation", error));
  };
  const finish = (request: LocalAssistReviewRequest, accepted: boolean) => {
    const job = pendingRef.current;
    if (job?.request !== request) return;
    clearTimeout(job.timer);
    pendingRef.current = null;
    setPending(null);
    reply(request, accepted && Date.now() < job.expiresAt);
  };

  useEffect(() => {
    let disposed = false;
    const subscription = listen<LocalAssistReviewRequest>(LOCAL_ASSIST_REVIEW_REQUEST_EVENT, ({ payload }) => {
      if (disposed) return;
      const tab = resolveReviewTab(payload, current.current.tabs);
      if (!payload.navigationId || blocked() || !tab || pendingRef.current) { reply(payload, false); return; }
      // One deadline spans tab selection AND the native focus promise. Renders never extend it.
      pendingRef.current = { request: payload, expiresAt: Date.now() + 4000, focusStarted: false,
        timer: setTimeout(() => finish(payload, false), 4000) };
      setPending(payload);
      current.current.onSelectTab(tab.id);
    }).catch(() => null); // Browser preview has no native event transport.
    return () => {
      disposed = true;
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      void subscription.then((unlisten) => unlisten?.());
    };
  }, []);

  useEffect(() => {
    const job = pendingRef.current;
    if (!pending || job?.request !== pending) return;
    const tab = resolveReviewTab(pending, options.tabs);
    if (Date.now() >= job.expiresAt || blocked() || !tab) { finish(pending, false); return; }
    if (options.activeTab?.sessionId !== tab.sessionId) return;
    const region = options.hostRef.current?.querySelector<HTMLElement>('[data-review-request-id]');
    if (!region || region.dataset.reviewRequestId !== pending.requestId) { finish(pending, false); return; }
    if (job.focusStarted) return;
    job.focusStarted = true;
    // まず表示領域を開く（`display: none` のままでは focus しても何も起きない）。
    current.current.onRevealRegion?.();
    void focusMainLocalAssistReview().then(() => {
      if (pendingRef.current !== job) return;
      /**
       * 開示 → 再検証 → フォーカス。表示の切替は1フレーム後なので、数フレームまで
       * 再試行する。成功条件は `document.activeElement === region`（DOMがあることや
       * タブが合っていることでは「開けた」としない）。
       */
      const attempt = (retriesLeft: number) => {
        if (pendingRef.current !== job) return;
        if (Date.now() >= job.expiresAt || blocked() ||
            current.current.activeTab?.sessionId !== pending.documentSessionId ||
            !resolveReviewTab(pending, current.current.tabs)) { finish(pending, false); return; }
        const live = current.current.hostRef.current?.querySelector<HTMLElement>("[data-review-request-id]");
        if (!live || live.dataset.reviewRequestId !== pending.requestId) { finish(pending, false); return; }
        live.focus();
        if (document.activeElement === live) { finish(pending, true); return; }
        if (retriesLeft <= 0) { finish(pending, false); return; }
        if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
          window.requestAnimationFrame(() => attempt(retriesLeft - 1));
        } else {
          setTimeout(() => attempt(retriesLeft - 1), 0);
        }
      };
      attempt(3);
    }).catch(() => finish(pending, false));
  }, [pending, options.activeTab, options.tabs, options.blocked, options.hostRef]);
}
