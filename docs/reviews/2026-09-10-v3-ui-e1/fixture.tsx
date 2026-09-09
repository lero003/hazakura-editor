// Display fixture: real parser/Outline, no document writes.
import React from "react";
import { createRoot } from "react-dom/client";
import { OutlinePane } from "../../../src/components/editor/OutlinePane";
import { getSidePaneCopy } from "../../../src/lib/locale";
import { markdownStructureItems, parseMarkdownStructure } from "../../../src/features/editor/markdownStructure";
import { analyzeMarkdownStructure } from "../../../src/features/editor/markdownStructureAdvisories";
import "../../../src/styles/index.css";
const source = "# 朝の余白\n\n庭の葉桜を眺めて、今日の一行を書く。\n\n### 散歩の記録\n\n川沿いを歩いた。\n\n## 帰り道\n\n夕方の光が静かに差し込む。";
const structure = parseMarkdownStructure(source);
document.documentElement.dataset.theme = "light";
createRoot(document.getElementById("root")!).render(<main style={{ height: "100vh", display: "grid", gridTemplateRows: "48px minmax(0,1fr)" }}>
  <p style={{ padding: 12, margin: 0 }}>UI-E1 表示fixture — 移動・編集は実行しません</p>
  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 326px", minHeight: 0 }}>
    <article style={{ whiteSpace: "pre-wrap", padding: 24 }}>{source}</article>
    <OutlinePane copy={getSidePaneCopy("ja")} currentHeadingLine={5} items={markdownStructureItems(structure)}
      advisories={analyzeMarkdownStructure(source, structure)} truncated={false} onSelect={() => {}} onChangeHeadingLevel={() => {}} />
  </div>
</main>);
