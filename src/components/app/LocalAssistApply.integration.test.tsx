import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalAssistSidebar } from "./LocalAssistSidebar";
import { LocalAssistProposalReview } from "./LocalAssistProposalReview";
import {
  registerLocalAssistController,
  publishSidebarProposalStatus,
} from "../../lib/appleAssist/sidebarBridge";
import {
  localAssistProposalStore,
  type LocalAssistProposal,
} from "../../features/editor/localAssistProposal";
import { useLocalAssistReviewActions } from "../../hooks/editor/useLocalAssistReviewActions";
import type { AppleAssistTargetSnapshot, EditorTab } from "../../types";
import type { EditorPaneHandle } from "../editor/EditorPane";

vi.mock("@tauri-apps/api/event", () => ({ emitTo: vi.fn(async () => {}) }));

const SESSION = "apply-integration";
const tab = {
  id: "a",
  sessionId: SESSION,
  name: "note.md",
  path: "/workspace/note.md",
  contents: "original",
} as EditorTab;

const target: AppleAssistTargetSnapshot = {
  kind: "paragraph",
  start: 0,
  end: 8,
  text: "original",
  label: "",
  activeDocumentPath: tab.path,
  activeDocumentName: tab.name,
  activeDocumentSessionId: SESSION,
  capturedAtMs: 0,
};

function completedProposal(): LocalAssistProposal {
  return {
    requestId: "req-apply-1",
    request: "整えて",
    actionId: "rewrite_natural",
    originalText: "original",
    candidateText: "整えた本文",
    target,
    conversationId: null,
    turnIndex: 0,
  };
}

let unregister: () => void;
const requests: { requestId: string; conversationId: string; target: AppleAssistTargetSnapshot }[] = [];

beforeEach(() => {
  requests.length = 0;
  unregister = registerLocalAssistController({
    request: (request) => {
      requests.push(request as never);
    },
    cancel: async () => true,
    isBusy: () => false,
  });
  localAssistProposalStore.clear(SESSION);
});

afterEach(() => {
  cleanup();
  unregister();
  localAssistProposalStore.clear(SESSION);
  vi.clearAllMocks();
});

// Use the production review hook, including its session-aware writer and
// proposal consumption, rather than reproducing the orchestration here.
it("applies through the real single writer, consumes the proposal, and leaves nothing to apply twice", async () => {
  const writes = vi.fn();
  const { result } = renderHook(() => {
    const [tabs, setTabs] = useState([tab]);
    const actions = useLocalAssistReviewActions({
      activeTab: tabs[0], tabs, setActiveTabId: vi.fn(), setStatus: vi.fn(),
      rejectIfAppleAssistLocksTab: () => false,
      setTabs: (next) => { writes(); setTabs(next); },
    });
    return { ...actions, tabs };
  });

  render(
    <>
      <LocalAssistSidebar
        activeTab={tab}
        availability={{ kind: "available" }}
        availabilityProbed
        editorPaneRef={
          {
            current: {
              getActiveDocument: () => ({ text: tab.contents, from: 0, to: 8 }),
            } as EditorPaneHandle,
          }
        }
        fontSize={16}
        menuLanguage="ja"
        onApply={(proposal) => result.current.applyLocalAssistProposal(proposal)}
        onClose={vi.fn()}
        onDiscard={(proposal) => result.current.discardLocalAssistProposal(proposal)}
        onOpenFile={vi.fn()}
        onSelectTab={vi.fn()}
        open
        tabs={[tab]}
        textEditorVisible
      />
    </>,
  );

  // 1) 本番どおりサイドバーから依頼を送る（会話IDはサイドバーが作る）。
  await act(async () => {
    fireEvent.change(screen.getByLabelText("文章への依頼"), {
      target: { value: "整えて" },
    });
    fireEvent.click(screen.getByRole("button", { name: "案を作る" }));
  });
  expect(requests).toHaveLength(1);
  const sent = requests[0];

  // 2) 生成が完了した状態を作る（この会話の提案としてストアへ入り、ターンが決着する）。
  const proposal = { ...completedProposal(), requestId: sent.requestId, conversationId: sent.conversationId, target: sent.target };
  await act(async () => {
    localAssistProposalStore.record(SESSION, proposal);
    publishSidebarProposalStatus({ requestId: sent.requestId, phase: "completed", conversationId: sent.conversationId, emittedAtMs: 0 } as never);
  });

  // 提案があるのでレビュー面が出ている。
  const applyButton = await screen.findByRole("button", { name: "文書へ反映" });
  await act(async () => {
    applyButton.click();
  });

  // 本番の単一ライタが1回だけ書き、提案を消費する。
  await waitFor(() => expect(writes).toHaveBeenCalledOnce());
  expect(result.current.tabs[0].contents).toBe("整えた本文");
  expect(result.current.tabs[0].sessionId).toBe(SESSION);
  expect(localAssistProposalStore.getLatest(SESSION)).toBeNull();

  // 消費後はレビュー面そのものが消える（同じ案を二度反映できない）。
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "文書へ反映" })).toBeNull(),
  );

  // サイドバーには「反映したが未保存」の完了通知が出る（消費済み提案を残して通知するのではない）。
  await waitFor(() =>
    expect(screen.getByText(/文書へ反映しました/)).toBeTruthy(),
  );

  // 消費後にもう一度同じ提案を流しても、単一ライタが拒否して文書は書かれない。
  const second = await result.current.applyLocalAssistProposal(proposal);
  expect(second.ok).toBe(false);
  expect(writes).toHaveBeenCalledOnce();
});

it("keeps the review surface while a proposal is still present", async () => {
  const proposal = completedProposal();
  localAssistProposalStore.record(SESSION, proposal);
  render(
    <LocalAssistProposalReview
      activeTab={tab}
      fontSize={16}
      menuLanguage="ja"
      onApply={vi.fn(async () => ({ ok: true as const }))}
      onDiscard={vi.fn()}
    />,
  );
  // 進行中・未完の提案はレビュー面に出続ける（消費は適用のときだけ）。
  expect(await screen.findByRole("button", { name: "文書へ反映" })).toBeTruthy();
  expect(localAssistProposalStore.getLatest(SESSION)).toBe(proposal);
  publishSidebarProposalStatus({
    requestId: proposal.requestId,
    phase: "completed",
    emittedAtMs: 0,
  } as never);
});
