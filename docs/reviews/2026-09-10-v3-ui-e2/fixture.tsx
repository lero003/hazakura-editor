// Display fixture: real search component, sample rows, no native search/open.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalSearch } from "../../../src/components/globalSearch/GlobalSearch";
import "../../../src/styles/index.css";
const rows = ["第一章/朝の余白.md", "第二章/散歩の記録.md"].map((relativePath, index) => {
  const match = { line: index + 3, column: 1, text: "葉桜が風に揺れる朝、今日の一行を書きはじめた。" };
  return { fileIndex: index, matchIndex: 0, file: { path: `fixture/${relativePath}`, relativePath, matches: [match], truncated: false }, match };
});
document.documentElement.dataset.theme = "light";
function Fixture() {
  const [open, setOpen] = useState(true); const [query, setQuery] = useState("葉桜"); const [active, setActive] = useState(0);
  return <main><p>UI-E2表示fixture — 検索・ファイルを開く処理なし</p><button onClick={() => setOpen(true)}>検索を開く</button>
    {open && <GlobalSearch workspaceOpen workspaceName="葉桜の散歩帳" activeIndex={active} menuLanguage="ja" onClose={() => setOpen(false)}
      onRun={() => setOpen(false)} onSetActiveIndex={setActive} onSetQuery={setQuery} query={query} rows={rows} searchError={null} searching={false}
      summary={{ totalFilesScanned: 12, totalMatches: 2, truncated: true }} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
