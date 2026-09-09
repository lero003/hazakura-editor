// Browser-only display fixture. No native reads, disk writes or restore handler.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { DiffPane } from "../../../src/components/diff/DiffPane";
import { buildLineDiff } from "../../../src/features/diff/diff";
import { captureChangeReviewSnapshot } from "../../../src/features/diff/changeReviewStale";
import type { EditorTab, CompareCase } from "../../../src/types";
import "../../../src/styles/index.css";
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") || "light";
const language = params.get("language") === "kana" ? "kana" : "ja";
const source = "# 朝の余白\n\n窓を開けると、庭の葉桜が揺れていた。\nコーヒーを淹れ、今日の一行を書きはじめる。";
const tab = { id: "fixture", sessionId: "fixture-session", path: "fixture/document.md", name: "朝の余白と散歩の記録.md", contents: source,
  lastSavedContents: source, encoding: "utf-8", line_ending: "lf" } as EditorTab;
const backup = params.get("view") === "backup";
const comparison: CompareCase = backup ? {
  kind: "changes", key: "fixture", scope: "backup-vs-buffer", documentPath: tab.path, documentLabel: tab.name,
  leftColumnLabel: "バックアップ", rightColumnLabel: "現在の編集", capturedSnapshot: captureChangeReviewSnapshot(tab),
  backupApplyAction: { backupName: "sample", backupContents: source.replace("庭", "公園") },
} : { kind: "file", key: "fixture", leftPath: "fixture/reference.md", rightPath: tab.path,
  anchor: { path: "fixture/reference.md", name: "昨日の散歩と朝の記録.md", label: "参照元" },
  target: { path: tab.path, name: tab.name, label: "現在の編集" } };
const view = { caseKey: "fixture", ...buildLineDiff(source.replace("庭", "公園"), source) };
function Fixture() {
  const [open, setOpen] = useState(true);
  const [edited, setEdited] = useState(false);
  return <main style={{ height: "100vh", display: "grid", gridTemplateRows: "48px minmax(0,1fr)" }}>
    <div style={{ padding: 8 }}>UI-D2 表示fixture（保存・復元処理なし） <button onClick={() => setOpen(true)}>比較を開く</button> <button onClick={() => setEdited(true)}>比較後に編集</button></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
      <article style={{ padding: 24, whiteSpace: "pre-wrap" }}>{source}{edited ? "\n追記した文章。" : ""}</article>
      {open && <DiffPane compareCase={comparison} documentTab={{ ...tab, contents: edited ? source + "\n追記した文章。" : source }}
        view={view} menuLanguage={language} onClose={() => setOpen(false)} onApplyBackup={() => {}} />}
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
