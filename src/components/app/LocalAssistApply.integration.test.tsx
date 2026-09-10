import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import {
  applyReviewedLocalAssistProposal,
  emitLocalAssistApplyStatus,
} from "../../hooks/editor/useAppleAssistApplyHandler";
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

/**
 * 依頼書の受入範囲の指摘への対応: 確認用 fixture の `onApply` は「成功を返すだけ」で、
 * 本番の提案消費（ストアからの削除）を通していなかった。ここでは本番の単一ライタ
 * `applyReviewedLocalAssistProposal` と本番のストアを使って、適用→消費→完了通知まで
 * 一本で通す。
 */
it("applies through the real single writer, consumes the proposal, and leaves nothing to apply twice", async () => {
  const writes: { text: string; sessionId: string }[] = [];

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
        // useAppShellController の本番の合成（単一ライタ → 消費 → 完了通知）を
        // そのまま写す。フック自体はシェル全体を要求するためここで組む。
        onApply={async (reviewed) => {
          const result = await applyReviewedLocalAssistProposal({
            proposal: reviewed,
            activeTab: tab,
            setActiveTabContents: (text, sessionId) => {
              writes.push({ text, sessionId });
            },
          });
          if (result.ok) {
            localAssistProposalStore.clear(tab.sessionId);
            await emitLocalAssistApplyStatus(
              "completed",
              "Hazakura Local Assist applied the reviewed proposal.",
              reviewed.requestId,
              reviewed.request,
              reviewed.conversationId,
              {
                shouldApplyToDocument: true,
                documentSessionId: reviewed.target.activeDocumentSessionId,
              },
            );
          }
          return result;
        }}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
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
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ text: "整えた本文", sessionId: SESSION });
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
  const second = await applyReviewedLocalAssistProposal({
    proposal,
    activeTab: tab,
    setActiveTabContents: (text, sessionId) => {
      writes.push({ text, sessionId });
    },
  });
  expect(second.ok).toBe(false);
  expect(writes).toHaveLength(1);
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
