// Vite-only review fixture. Not an application entry or a System-generation test.
import React from "react";
import { createRoot } from "react-dom/client";
import { AppleAssistWindowApp } from "../../../src/components/appleAssist/AppleAssistWindowApp";
import { LocalAssistProposalReview } from "../../../src/components/app/LocalAssistProposalReview";
import { localAssistProposalStore, type LocalAssistProposal } from "../../../src/features/editor/localAssistProposal";
import type { EditorTab } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
localStorage.setItem("hazakura-note-theme", theme);
document.documentElement.dataset.theme = theme;
const original = "忙しい日には、ついつい時間を何かで埋めたくなる。\n何もしない時間にも意味がある。" + (params.has("long") ? "\n長い文章でも、操作を見失わずに確かめます。".repeat(100) : "");
const tab = { id: "fixture", sessionId: "fixture-session", name: "朝の余白.md", path: "", contents: original } as EditorTab;
const proposal: LocalAssistProposal = {
  conversationId: "fixture-conversation", turnIndex: 0,
  requestId: "fixture-request", request: "重複を減らしてください", actionId: "rewrite_natural" as const,
  originalText: original, candidateText: original.replace("忙しい日には、ついつい", "忙しい日ほど、空いた").replace("意味がある。", "小さな意味がある。"),
  generation: { modelId: "fixture:helper-v0.12", latencyMs: null },
  target: { kind: "paragraph" as const, start: 0, end: original.length, text: original, label: "段落",
    activeDocumentPath: "", activeDocumentName: tab.name, activeDocumentSessionId: tab.sessionId, capturedAtMs: 0 },
};
localAssistProposalStore.record(tab.sessionId, proposal);
createRoot(document.getElementById("root")!).render(params.get("surface") === "assist"
  ? <AppleAssistWindowApp />
  : <main className="v3-shell"><p>UI-C1 表示fixture — 実生成・実反映の証拠ではありません</p>
    <LocalAssistProposalReview activeTab={tab} fontSize={18} menuLanguage="ja" blocked={params.get("blocked") === "true"}
      onApply={async () => ({ ok: false, error: "表示fixture: 本文への反映は行いません。" })}
      onDiscard={() => localAssistProposalStore.clear(tab.sessionId)} /></main>);
