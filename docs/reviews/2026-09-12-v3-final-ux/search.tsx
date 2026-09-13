// 実コンポーネントの操作確認。架空のファイル名のみを使い、ネイティブI/Oは行わない。
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuickOpen } from "../../../src/components/editor/QuickOpen";
import { CommandPalette } from "../../../src/components/commandPalette/CommandPalette";
import { useCommandPalette } from "../../../src/hooks/commandPalette/useCommandPalette";
import type { WorkspaceTreeEntry } from "../../../src/lib/tauri";
import "../../../src/styles/index.css";

const tree: WorkspaceTreeEntry = {
  name: "原稿", path: "/workspace", kind: "directory",
  children_loaded: true, children_truncated: false,
  children: ["朝の余白.md", "朝の散歩.md", "夜の余白.md", "夜の散歩.md"].map((name) => ({
    name, path: `/workspace/${name}`, kind: "file",
    children_loaded: true, children_truncated: false, children: [],
  })),
};

function Fixture() {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState("未選択");
  const palette = useCommandPalette({ commands: tree.children.map((file) => ({
    id: file.path, label: file.name, category: "確認用", run: () => setOpened(file.path),
  })) });
  return <main>
    <button onClick={() => setOpen(true)}>ファイルを探す</button>
    <button onClick={palette.openCommandPalette}>コマンドを探す</button>
    <p role="status">{opened}</p>
    {open && <QuickOpen tree={tree} menuLanguage="ja" onClose={() => setOpen(false)} onOpenFile={setOpened} />}
    {palette.commandPaletteVisible && <CommandPalette activeIndex={palette.activeIndex}
      commands={palette.filteredCommands} menuLanguage="ja" query={palette.query}
      onClose={palette.closeCommandPalette} onRun={palette.runCommand}
      onSetQuery={palette.setQuery} onSetActiveIndex={palette.setActiveIndex} />}
  </main>;
}
document.documentElement.dataset.theme = "light";
createRoot(document.getElementById("root")!).render(<Fixture />);
