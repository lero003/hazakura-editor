// Display-only: real conflict surface and dismissal hook, no native save/read.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SaveConflictDialog } from "../../../src/components/app/SaveConflictDialog";
import { useSaveConflictSurface } from "../../../src/hooks/document/useSaveConflictSurface";
import type { EditorTab } from "../../../src/types";
import "../../../src/styles/index.css";
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") || "light";
const language = params.get("language") === "kana" ? "kana" : "ja";
function Fixture() {
  const [text, setText] = useState("# 朝の余白\n\n窓を開けると、庭の葉桜が揺れていた。");
  const [result, setResult] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  const tab = { id: "sample", sessionId: "sample-session", path: "fixture/note.md", name: "朝の余白と散歩の記録.md", contents: text, externalFingerprint: "changed", error: "conflict", saveStatus: "conflict" } as EditorTab;
  const surface = useSaveConflictSurface(tab, true);
  const back = () => { surface.dismiss(); requestAnimationFrame(() => editor.current?.focus()); };
  return <main style={{ padding: 24 }}><p>D2b 表示fixture — 保存・読込処理なし</p>
    <p role="status">保存の衝突は未解決です。</p><button onClick={surface.reopen}>保存の衝突を確認</button>
    <textarea aria-label="本文" ref={editor} value={text} onChange={event => setText(event.target.value)} style={{ display: "block", width: "90%", height: 300, marginTop: 20 }} />
    <p>{result}</p>
    {surface.tab && <SaveConflictDialog tab={surface.tab} menuLanguage={language} onBack={back}
      onCompare={() => { back(); setResult("表示fixture: 比較を要求（実際のreadなし）"); }}
      onSaveAs={() => { back(); setResult("表示fixture: 別名保存を要求（実際の保存なし）"); }} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
