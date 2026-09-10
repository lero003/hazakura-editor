// 画面07: 生成された案を**主編集領域**で読む（フローティングではない）。
// 実コンポーネントを、アプリと同じクラス構造（`.reference-editor-host` /
// `.proposal-review-host`）の中に置き、レイアウトを実測するための fixture。
// 提案は既存ストアへ実際に記録する（ネイティブ生成は呼び出さない）。
//   ?theme=light|dark
import React from "react";
import { createRoot } from "react-dom/client";
import { LocalAssistProposalReview } from "../../../src/components/app/LocalAssistProposalReview";
import { localAssistProposalStore, type LocalAssistProposal } from "../../../src/features/editor/localAssistProposal";
import type { EditorTab, ThemePreference } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = (params.get("theme") ?? "light") as ThemePreference;

// 長文（本文面でスクロールすることを確かめる）。
const lines = Array.from({ length: 90 }, (_, index) =>
  index % 9 === 0
    ? `## 見出し ${index / 9 + 1}`
    : `窓を開けると、まだ名前のない朝の匂いがした。葉桜の下で、今日の一行を書きはじめる。(${index})`,
);
const original = ["# 朝の余白", "", ...lines].join("\n");
const candidate = original
  .split("\n")
  .map((line) => (line.startsWith("#") ? line : line.replace("まだ名前のない", "名もない")))
  .join("\n");

const activeTab = {
  id: "/workspace/02_朝の余白.md",
  sessionId: "session:fixture-07",
  name: "02_朝の余白.md",
  path: "/workspace/02_朝の余白.md",
  contents: original,
} as EditorTab;

const proposal: LocalAssistProposal = {
  requestId: "req-fixture-07",
  request: "意味を変えず、もう少し短くして",
  actionId: "rewrite_natural",
  originalText: original,
  candidateText: candidate,
  conversationId: "conv-fixture",
  turnIndex: 0,
  generation: { modelId: "apple:foundation-models:system-default" },
  target: {
    kind: "document",
    start: 0,
    end: original.length,
    text: original,
    label: "",
    activeDocumentPath: activeTab.path,
    activeDocumentName: activeTab.name,
    activeDocumentSessionId: activeTab.sessionId,
    capturedAtMs: 0,
  },
} as LocalAssistProposal;

localAssistProposalStore.record(activeTab.sessionId, proposal);

createRoot(document.getElementById("root")!).render(
  <div className="v3-shell">
    {/* アプリと同じ箱: 本文領域（`.reference-editor-host`）の中に置く。 */}
    <div className="reference-editor-host" data-fixture="editor-region">
      <div className="proposal-review-host">
        <LocalAssistProposalReview
          activeTab={activeTab}
          fontSize={14}
          menuLanguage="ja"
          onApply={async () => ({ ok: true as const })}
          onDiscard={() => {}}
        />
      </div>
    </div>
  </div>,
);
