// Display-only fixture using the real Reader. No native open or save.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BookScopeReader } from "../../../src/components/workspace/BookScopeReader";
import "../../../src/styles/index.css";
const documents = ["朝の余白", "散歩の途中で", "机と窓辺"].map((name, index) => ({
  name: `${name}.md`, path: `/fixture/${index}.md`, relativePath: `chapters/${name}.md`, usesLiveBuffer: index === 1,
  source: `# ${name}\n\n` + "窓を開けると、まだ名前のない朝の匂いがした。葉桜の下で、今日の一行を書きはじめる。\n\n".repeat(12),
}));
document.documentElement.dataset.theme = "light";
function Fixture() {
 const [open, setOpen] = useState(true);
 return open ? <BookScopeReader documents={documents} failures={[]} skippedForBudget={[]}
   menuLanguage="ja" workspaceRoot="/fixture" onClose={() => setOpen(false)}
   onEditChapter={async () => false} onOpenLink={() => {}} /> : <button onClick={() => setOpen(true)}>Reader表示fixtureを開く</button>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
