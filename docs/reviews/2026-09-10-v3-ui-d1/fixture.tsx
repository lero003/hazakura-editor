// Display-only fixture. No native backup reads, writes or restore operations.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ImagePreviewPane } from "../../../src/components/editor/preview/ImagePreviewPane";
import { RestoreFromBackupDialog } from "../../../src/components/backup/RestoreFromBackupDialog";
import { getAutoBackupRestoreCopy } from "../../../src/lib/locale/autoBackup";
import "../../../src/styles/index.css";
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") || "light";
const language = params.get("language") === "kana" ? "kana" : "ja";
const entries = Array.from({ length: 20 }, (_, i) => ({ name: `朝の余白と散歩の記録-${i + 1}.md`, path: `fixture/${i}`, modifiedAtMs: 1788966000000 - i * 60000, size: 2048 + i }));
function Fixture() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("");
  return <main style={{ height: "100vh", display: "grid", gridTemplateRows: "40px minmax(0,1fr)" }}>
    <p style={{ margin: 8 }}>UI-D1 表示fixture — サンプル候補・復元処理なし</p>
    {params.get("view") === "image" ? <ImagePreviewPane menuLanguage={language} title="画像"
      image={{ name: "hazakura-mark.png", path: "src/assets/hazakura-mark.png", url: params.has("broken") ? "./missing.png" : "/src/assets/hazakura-mark.png", size: 307180 }} /> : <div>
      <button onClick={() => setOpen(true)}>バックアップ一覧を開く</button><p>{selected}</p>
      {open ? <RestoreFromBackupDialog copy={getAutoBackupRestoreCopy(language)} entries={entries}
        error={null} fileLabel="朝の余白と散歩の記録.md" loading={false} onClose={() => setOpen(false)}
        onSelect={entry => { setSelected(`表示fixture: ${entry.name}を選択。実際の比較・復元は行いません。`); setOpen(false); }} /> : null}
    </div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
