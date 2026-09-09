import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocalAssistReviewNavigation, resolveReviewTab } from "./useLocalAssistReviewNavigation";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import type { EditorTab } from "../../types";
import type { LocalAssistReviewIdentity } from "../../features/editor/localAssistReviewIdentity";
const h = vi.hoisted(() => ({ receive: null as null | ((event: { payload: LocalAssistReviewIdentity }) => void),
  focus: vi.fn(async (): Promise<void> => undefined), emit: vi.fn(async () => undefined), select: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_name, handler) => { h.receive = handler; return () => { h.receive = null; }; }),
  emitTo: (...args: unknown[]) => h.emit(...args as []),
}));
vi.mock("../../lib/tauri/localAssistReview", () => ({ focusMainLocalAssistReview: () => h.focus() }));
const tab = { id: "tab2", sessionId: "session2", path: "/workspace/same.md", contents: "original" } as EditorTab;
const other = { ...tab, id: "tab1", sessionId: "session1" };
const identity = { requestId: "request2", conversationId: "conversation", documentSessionId: tab.sessionId };
const proposal: LocalAssistProposal = { ...identity, request: "revise", actionId: "rewrite_natural", originalText: "original", candidateText: "proposal", turnIndex: 1,
  target: { kind: "paragraph", text: "original", start: 0, end: 8, label: "", activeDocumentPath: tab.path, activeDocumentName: "same.md",
    activeDocumentSessionId: tab.sessionId, capturedAtMs: 0 } };
function Main({ blocked = false }: { blocked?: boolean }) {
  const [active, setActive] = useState(other);
  const hostRef = useRef<HTMLDivElement>(null);
  useLocalAssistReviewNavigation({ tabs: [other, tab], activeTab: active, blocked, hostRef,
    onSelectTab: (id) => { h.select(id); setActive(tab); } });
  return <><textarea defaultValue="unchanged" /><div ref={hostRef}><div role="region" tabIndex={-1}
    data-review-request-id={active === tab ? identity.requestId : "other"}>{active.sessionId}</div></div></>;
}
beforeEach(() => { vi.clearAllMocks(); localAssistProposalStore.record(tab.sessionId, proposal); });
afterEach(() => { cleanup(); localAssistProposalStore.clear(tab.sessionId); });
it("selects the matching session despite identical paths, then focuses its rendered proposal", async () => {
  render(<Main />);
  await act(async () => h.receive!({ payload: identity }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region")));
  expect(h.select).toHaveBeenCalledWith("tab2");
  expect(screen.getByRole("region").textContent).toBe(tab.sessionId);
  expect(h.emit).toHaveBeenLastCalledWith("apple-assist", "local-assist-review-result", { ...identity, accepted: true });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("unchanged");
});
it("refuses Reader/modal navigation before selecting or focusing", async () => {
  render(<Main blocked />);
  await act(async () => h.receive!({ payload: identity }));
  expect(h.select).not.toHaveBeenCalled(); expect(h.focus).not.toHaveBeenCalled();
  expect(h.emit).toHaveBeenLastCalledWith("apple-assist", "local-assist-review-result", { ...identity, accepted: false });
});
it("rejects consumed, stale, streaming and mismatched proposals", () => {
  expect(resolveReviewTab(identity, [other, tab])).toBe(tab);
  expect(resolveReviewTab({ ...identity, requestId: "old" }, [tab])).toBeNull();
  expect(resolveReviewTab({ ...identity, conversationId: "old" }, [tab])).toBeNull();
  expect(resolveReviewTab(identity, [other])).toBeNull();
  expect(resolveReviewTab(identity, [{ ...tab, contents: "edited" }])).toBeNull();
  localAssistProposalStore.record(tab.sessionId, { ...proposal, streaming: true });
  expect(resolveReviewTab(identity, [tab])).toBeNull();
  localAssistProposalStore.clear(tab.sessionId);
  expect(resolveReviewTab(identity, [tab])).toBeNull();
});
it("revalidates after asynchronous native focus and refuses a replaced proposal", async () => {
  let focused!: () => void;
  h.focus.mockImplementationOnce(() => new Promise<void>(resolve => { focused = resolve; }));
  render(<Main />);
  await act(async () => h.receive!({ payload: identity }));
  localAssistProposalStore.record(tab.sessionId, { ...proposal, requestId: "replacement" });
  await act(async () => focused());
  expect(document.activeElement).not.toBe(screen.getByRole("region"));
  expect(h.emit).toHaveBeenLastCalledWith("apple-assist", "local-assist-review-result", { ...identity, accepted: false });
});

it("leaves an open modal and the active tab untouched", async () => {
  render(<><div role="dialog" aria-modal="true">Modal</div><Main /></>);
  await act(async () => h.receive!({ payload: identity }));
  expect(h.select).not.toHaveBeenCalled();
  expect(h.focus).not.toHaveBeenCalled();
});
