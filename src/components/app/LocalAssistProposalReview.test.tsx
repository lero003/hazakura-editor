import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalAssistProposalReview } from "./LocalAssistProposalReview";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import type { EditorTab } from "../../types";

const activeTab = {
  id: "/workspace/note.md",
  sessionId: "session:note-1",
  name: "note.md",
  path: "/workspace/note.md",
  contents: "original",
} as unknown as EditorTab;

function seedProposal() {
  localAssistProposalStore.record("session:note-1", {
    requestId: "req-1",
    request: "整えて",
    actionId: "rewrite_natural",
    originalText: "original",
    candidateText: "proposal",
    target: {
      kind: "paragraph",
      start: 0,
      end: "original".length,
      text: "original",
      label: "",
      activeDocumentPath: "/workspace/note.md",
      activeDocumentName: "note.md",
      activeDocumentSessionId: "session:note-1",
      capturedAtMs: 0,
    },
    conversationId: "conv-1",
    turnIndex: 0,
  });
}

afterEach(() => {
  cleanup();
  localAssistProposalStore.clear("session:note-1");
});

describe("LocalAssistProposalReview", () => {
  it("renders nothing when there is no unapplied proposal", () => {
    render(
      <LocalAssistProposalReview
        activeTab={activeTab}
        fontSize={14}
        menuLanguage="en"
        onApply={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByRole("region", { name: "Proposal review" })).toBeNull();
  });

  it("renders the original-vs-proposal Diff and forwards Apply/Discard", () => {
    seedProposal();
    const onApply = vi.fn(async () => ({ ok: true as const }));
    const onDiscard = vi.fn();

    render(
      <LocalAssistProposalReview
        activeTab={activeTab}
        fontSize={14}
        menuLanguage="en"
        onApply={onApply}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByTestId("local-assist-proposal-review")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Original" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Proposal" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ candidateText: "proposal" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard proposal" }));
    expect(onDiscard).toHaveBeenCalledWith(
      expect.objectContaining({ candidateText: "proposal" }),
    );
  });

  it("shows an inline error when apply is rejected", async () => {
    seedProposal();
    const onApply = vi.fn(async () => ({
      ok: false,
      error: "Hazakura Local Assist apply rejected: stale target.",
    }));

    render(
      <LocalAssistProposalReview
        activeTab={activeTab}
        fontSize={14}
        menuLanguage="en"
        onApply={onApply}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    await screen.findByTestId("local-assist-proposal-review-error");
    expect(
      screen.getByTestId("local-assist-proposal-review-error").textContent,
    ).toContain("stale target");
  });
});
