import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalAssistSidebar } from "./LocalAssistSidebar";
import { registerLocalAssistController, publishSidebarProposalStatus } from "../../lib/appleAssist/sidebarBridge";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import type { AppleAssistApplyEvent, EditorTab } from "../../types";
import type { EditorPaneHandle } from "../editor/EditorPane";

vi.mock("./LocalAssistProposalReview", () => ({ LocalAssistProposalReview: () => <div data-testid="shared-review" /> }));
const tab = { id: "a", sessionId: "a-session", name: "a.md", path: "/workspace/a.md", contents: "before\nTARGET\nafter" } as EditorTab;
const requests: AppleAssistApplyEvent[] = [];
let unregister: () => void;
const onApply = vi.fn(async () => ({ ok: true as const }));
const onSelectTab = vi.fn();
function props() {
  return { open: true, activeTab: tab, tabs: [tab], menuLanguage: "ja" as const, fontSize: 16,
    availability: { kind: "available" as const }, availabilityProbed: true, textEditorVisible: true,
    editorPaneRef: { current: { getActiveDocument: () => ({ text: tab.contents, from: 7, to: 13 }) } as EditorPaneHandle },
    onApply, onDiscard: vi.fn(), onSelectTab, onOpenFile: vi.fn(), onClose: vi.fn() };
}
beforeEach(() => {
  requests.length = 0; onApply.mockClear(); onSelectTab.mockClear();
  unregister = registerLocalAssistController({ request: (request) => requests.push(request), cancel: async () => true, isBusy: () => false });
  localAssistProposalStore.clear(tab.sessionId);
});
afterEach(() => { cleanup(); unregister(); localAssistProposalStore.clear(tab.sessionId); });
describe("Local Assist sidebar", () => {
  it("names the stop action and shows a classified reason with a retry after a failure", () => {
    render(<LocalAssistSidebar {...props()} />);
    fireEvent.change(screen.getByLabelText("文章への依頼"), { target: { value: "短くして" } });
    fireEvent.click(screen.getByRole("button", { name: "案を作る" }));
    // 生成中はモックの文言で停止できる。
    expect(screen.getByRole("button", { name: "生成を停止" })).toBeTruthy();
    const request = requests[0];
    act(() => {
      publishSidebarProposalStatus({
        phase: "failed", message: "Selected text exceeds the maximum length",
        requestId: request.requestId, request: request.request,
        conversationId: request.conversationId, emittedAtMs: Date.now(),
      });
    });
    // 生の内部文字列ではなく、分類した短い案内を出す。
    expect(screen.getByText("対象が4,000文字を超えています。範囲を短くしてください。")).toBeTruthy();
    expect(screen.queryByText(/Selected text exceeds/)).toBeNull();
    // 同じ依頼をやり直す入口（送信と同じ経路）。
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(requests).toHaveLength(2);
  });

  it("sends the selected source as a proposal, never applies automatically", () => {
    render(<LocalAssistSidebar {...props()} />);
    fireEvent.change(screen.getByLabelText("文章への依頼"), { target: { value: "短くして" } });
    fireEvent.click(screen.getByRole("button", { name: "案を作る" }));
    expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ shouldApplyToDocument: false, target: { text: "TARGET", activeDocumentSessionId: tab.sessionId } });
    expect(onApply).not.toHaveBeenCalled(); expect(tab.contents).toBe("before\nTARGET\nafter");
  });
  it("refines the exact completed proposal with successful request history", () => {
    render(<LocalAssistSidebar {...props()} />);
    const composer = screen.getByLabelText("文章への依頼");
    fireEvent.change(composer, { target: { value: "最初の依頼" } }); fireEvent.click(screen.getByRole("button", { name: "案を作る" }));
    const first = requests[0];
    act(() => {
      localAssistProposalStore.record(tab.sessionId, { requestId: first.requestId, request: first.request, actionId: "rewrite_natural",
        originalText: "TARGET", candidateText: "current proposal", target: first.target!, conversationId: first.conversationId!, turnIndex: 0 });
      publishSidebarProposalStatus({ phase: "completed", requestId: first.requestId, request: first.request, message: "done", conversationId: first.conversationId, emittedAtMs: 0 });
    });
    fireEvent.change(composer, { target: { value: "次の依頼" } }); fireEvent.click(screen.getByRole("button", { name: "案をさらに直す" }));
    expect(requests[1]).toMatchObject({ proposalText: "current proposal", conversationOriginalText: "TARGET", revisionHistory: ["最初の依頼"] });
  });
  it("validates line ranges and requires explicit whole-document choice", () => {
    render(<LocalAssistSidebar {...props()} />); fireEvent.click(screen.getByLabelText("行を指定"));
    fireEvent.change(screen.getByLabelText("開始行"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("終了行"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "対象を確認して固定" }));
    expect(screen.getByRole("alert").textContent).toContain("行番号"); expect(requests).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("終了行"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "対象を確認して固定" }));
    expect(screen.getByText("TARGET").textContent).toBe("TARGET");
  });
  it("preserves a draft across collapse and ignores IME confirmation Enter", () => {
    const initial = props(); const { rerender } = render(<LocalAssistSidebar {...initial} />);
    fireEvent.change(screen.getByLabelText("文章への依頼"), { target: { value: "書き置き" } });
    fireEvent.keyDown(screen.getByLabelText("文章への依頼"), { key: "Enter", metaKey: true, isComposing: true });
    expect(requests).toHaveLength(0);
    rerender(<LocalAssistSidebar {...initial} open={false} />); rerender(<LocalAssistSidebar {...initial} />);
    expect((screen.getByLabelText("文章への依頼") as HTMLTextAreaElement).value).toBe("書き置き");
  });
  it("uses normal tab selection and disables generation while unavailable", () => {
    const other = { ...tab, id: "b", sessionId: "b-session", name: "b.md", path: "/workspace/b.md" };
    render(<LocalAssistSidebar {...props()} tabs={[tab, other]} availability={{ kind: "unsupported" }} />);
    fireEvent.change(screen.getByLabelText("ページ（開いている文書）"), { target: { value: "b" } }); expect(onSelectTab).toHaveBeenCalledWith("b");
    fireEvent.change(screen.getByLabelText("文章への依頼"), { target: { value: "依頼" } });
    expect((screen.getByRole("button", { name: "案を作る" }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests).toHaveLength(0);
  });
});
