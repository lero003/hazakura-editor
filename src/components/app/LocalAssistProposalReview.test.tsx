import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalAssistProposalReview } from "./LocalAssistProposalReview";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import type { EditorTab } from "../../types";

const activeTab = { id: "/workspace/note.md", sessionId: "session:note-1", name: "note.md", path: "/workspace/note.md", contents: "original" } as EditorTab;
function seedProposal(overrides: Partial<LocalAssistProposal> = {}): LocalAssistProposal {
  const proposal: LocalAssistProposal = { requestId: "req-1", request: "整えて", actionId: "rewrite_natural",
    originalText: "original", candidateText: "proposal", conversationId: "conv-1", turnIndex: 0,
    target: { kind: "paragraph", start: 0, end: 8, text: "original", label: "", activeDocumentPath: activeTab.path,
      activeDocumentName: "note.md", activeDocumentSessionId: activeTab.sessionId, capturedAtMs: 0 }, ...overrides };
  localAssistProposalStore.record(activeTab.sessionId, proposal);
  return proposal;
}
function props() { return { activeTab, fontSize: 14, menuLanguage: "en" as const, onApply: vi.fn(async () => ({ ok: true as const })), onDiscard: vi.fn() }; }
afterEach(() => { cleanup(); localAssistProposalStore.clear(activeTab.sessionId); });

describe("LocalAssistProposalReview", () => {
  it("keeps a previous proposal readable but blocks apply and discard until cancellation settles", () => {
    seedProposal(); const input = props();
    const view = render(<LocalAssistProposalReview {...input} blocked />);
    const apply = screen.getByRole("button", { name: "Apply proposal" });
    const discard = screen.getByRole("button", { name: "Discard proposal" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(apply); fireEvent.click(discard);
    expect(input.onApply).not.toHaveBeenCalled(); expect(input.onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "After" }));
    expect(screen.getByRole("region", { name: "After" })).toBeTruthy();
    view.rerender(<LocalAssistProposalReview {...input} blocked={false} />);
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    expect(apply.closest("footer")).toBe(discard.closest("footer"));
  });

  it("blocks a legacy proposal with a residual prompt delimiter", () => {
    seedProposal({ candidateText: "proposal\n\nHAZAKURA_TEXT_END" });
    const input = props();
    render(<LocalAssistProposalReview {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    expect(input.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("format");
  });
  it("renders nothing when there is no unapplied proposal", () => {
    render(<LocalAssistProposalReview {...props()} />);
    expect(screen.queryByRole("region", { name: "Proposal review" })).toBeNull();
  });
  it("renders the original-vs-proposal Diff and forwards exactly the reviewed proposal", async () => {
    const proposal = seedProposal(); const input = props();
    render(<LocalAssistProposalReview {...input} />);
    expect(screen.getByTestId("local-assist-proposal-review")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Original" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Proposal" })).toBeTruthy();
    // 追加・削除は色だけに頼らない（凡例は DiffBody と同じ - / + 記号）。
    expect(screen.getByText("- Removed / + Added")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    await waitFor(() => expect(input.onApply).toHaveBeenCalledWith(proposal));
    // 反映後は同じ案の反映ボタンを残さず、未保存の案内に置き換える。
    await screen.findByText("Applied to the document (unsaved). Use ⌘Z to undo.");
    expect(screen.queryByRole("button", { name: "Applied" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply proposal" })).toBeNull();
  });
  it("forwards Discard separately without writing the document", () => {
    const proposal = seedProposal(); const input = props(); render(<LocalAssistProposalReview {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard proposal" }));
    expect(input.onDiscard).toHaveBeenCalledWith(proposal); expect(input.onApply).not.toHaveBeenCalled();
  });
  it("shows an inline error when apply is rejected", async () => {
    seedProposal(); const onApply = vi.fn(async () => ({ ok: false as const, error: "Hazakura Local Assist apply rejected: stale target." }));
    render(<LocalAssistProposalReview {...props()} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    expect((await screen.findByTestId("local-assist-proposal-review-error")).textContent).toContain("stale target");
  });
  it("blocks double-click and discard while an application is pending", async () => {
    seedProposal(); let resolve!: (result: { ok: true }) => void;
    const onApply = vi.fn(() => new Promise<{ ok: true }>((done) => { resolve = done; }));
    const input = props(); render(<LocalAssistProposalReview {...input} onApply={onApply} />);
    const button = screen.getByRole("button", { name: "Apply proposal" });
    fireEvent.click(button); fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Discard proposal" }));
    expect(onApply).toHaveBeenCalledTimes(1); expect(input.onDiscard).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Applying…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ ok: true }));
    expect(screen.queryByRole("button", { name: "Applied" })).toBeNull();
    expect(onApply).toHaveBeenCalledTimes(1);
  });
  it("catches thrown apply failures and retains the proposal", async () => {
    const proposal = seedProposal(); const onApply = vi.fn(async () => { throw new Error("unexpected"); });
    render(<LocalAssistProposalReview {...props()} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    expect((await screen.findByRole("alert")).textContent).toContain("kept");
    expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBe(proposal);
    expect((screen.getByRole("button", { name: "Apply proposal" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("does not put a late failure under a newer proposal", async () => {
    seedProposal(); let reject!: (error: Error) => void;
    const onApply = vi.fn(() => new Promise<{ ok: true }>((_resolve, fail) => { reject = fail; }));
    render(<LocalAssistProposalReview {...props()} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    act(() => { seedProposal({ requestId: "req-2", candidateText: "second proposal" }); });
    await act(async () => reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "Apply proposal" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("disables stale targets and hides the previous tab's proposal on switch", () => {
    seedProposal(); const input = props();
    const { rerender } = render(<LocalAssistProposalReview {...input} activeTab={{ ...activeTab, contents: "different" }} />);
    expect((screen.getByRole("button", { name: "Apply proposal" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("target has changed");
    rerender(<LocalAssistProposalReview {...input} activeTab={{ ...activeTab, sessionId: "reopened" }} />);
    expect(screen.queryByTestId("local-assist-proposal-review")).toBeNull();
  });
  it("offers exact Before/After text even when a line diff exceeds its budget", () => {
    const text = "長い本文\n".repeat(650) + "末尾  \n";
    seedProposal({ candidateText: text }); render(<LocalAssistProposalReview {...props()} fontSize={32} />);
    expect(screen.getByRole("region", { name: "After" }).textContent).toBe(text);
    expect((screen.getByRole("button", { name: "Diff" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Before" }));
    expect(screen.getByRole("region", { name: "Before" }).textContent).toBe("original");
    expect(screen.getByRole("region", { name: "Before" }).style.fontSize).toBe("32px");
  });
  it("explains no-op proposals instead of inviting a failed apply", () => {
    seedProposal({ candidateText: "original" }); render(<LocalAssistProposalReview {...props()} />);
    expect((screen.getByRole("button", { name: "Apply proposal" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("identical");
  });
  it("shows a generation status without making the previous proposal actionable", () => {
    seedProposal({ streaming: true, candidateText: "" }); render(<LocalAssistProposalReview {...props()} />);
    expect(screen.getByRole("status").textContent).toContain("Generating");
    expect(screen.queryByRole("button", { name: "Apply proposal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard proposal" })).toBeNull();
  });
  it("discloses the model that produced the draft and never guesses legacy metadata", () => {
    seedProposal({ generation: { modelId: "apple:foundation-models:system-default", latencyMs: 123 } });
    render(<LocalAssistProposalReview {...props()} menuLanguage="ja" />);
    expect(screen.getByText(/生成元: Apple Intelligence/)).toBeTruthy();
    act(() => { seedProposal({ requestId: "legacy" }); });
    expect(screen.getByText(/生成元: 不明/)).toBeTruthy();
    expect(screen.queryByText(/生成元: Apple Intelligence/)).toBeNull();
  });

});
