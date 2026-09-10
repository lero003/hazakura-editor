// Real HTML dialog; display fixture has no native picker or writer.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HtmlExportSettingsDialog } from "../../../src/components/app/HtmlExportSettingsDialog";
import "../../../src/styles/index.css";
document.documentElement.dataset.theme = "light";
function Fixture() {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLElement>(null), cancelButtonRef = useRef<HTMLButtonElement>(null);
  if (!open) return <button onClick={() => setOpen(true)}>HTML書き出しを開く</button>;
  return <HtmlExportSettingsDialog dialogRef={dialogRef} cancelButtonRef={cancelButtonRef}
    menuLanguage="ja" request={{ documentName: "朝の余白.md", hasUnsavedChanges: true,
      tabId: "fixture", sessionId: "fixture-session", workspaceRootPath: null }}
    onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
