// 画面07の実コンポーネントを、ローカル状態だけで描く。提案は既存ストアへ
// 実際に記録して本番と同じ経路で表示する（ネイティブ生成は呼び出さない）。
//   ?theme=light|dark
import React from "react";
import { createRoot } from "react-dom/client";
import { LocalAssistProposalReview } from "../../../src/components/app/LocalAssistProposalReview";
import { localAssistProposalStore, type LocalAssistProposal } from "../../../src/features/editor/localAssistProposal";
import type { EditorTab, ThemePreference } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = (params.get("theme") ?? "light") as ThemePreference;

const original = ["朝の余白", "", "まだ風は冷たく、道の端に薄い日向がある。", "江戸彼岸の枝は、いちばん先に色を持つ。"].join("\n");
const candidate = ["朝の余白", "", "風はまだ冷たい。道の端に薄い日向がある。", "江戸彼岸の枝だけが、いちばん先に色を持つ。"].join("\n");

const activeTab = {
  id: "/workspace/02_朝の余白.md", sessionId: "session:fixture", name: "02_朝の余白.md",
  path: "/workspace/02_朝の余白.md", contents: original,
} as EditorTab;

const proposal: LocalAssistProposal = {
  requestId: "req-fixture", request: "意味を変えず、もう少し短くして", actionId: "rewrite_natural",
  originalText: original, candidateText: candidate, conversationId: "conv-fixture", turnIndex: 0,
  generation: { modelId: "apple:foundation-models:system-default" },
  target: { kind: "paragraph", start: 0, end: original.length, text: original, label: "",
    activeDocumentPath: activeTab.path, activeDocumentName: activeTab.name,
    activeDocumentSessionId: activeTab.sessionId, capturedAtMs: 0 },
} as LocalAssistProposal;

localAssistProposalStore.record(activeTab.sessionId, proposal);

createRoot(document.getElementById("root")!).render(
  <div style={{ padding: 24, maxWidth: 980 }}>
    <LocalAssistProposalReview activeTab={activeTab} menuLanguage="ja" fontSize={14}
      onApply={async () => ({ ok: true as const })} onDiscard={() => {}} />
  </div>,
);
