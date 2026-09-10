// Real export dialogs, display only: no picker, writer or native I/O.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EpubExportSettingsDialog } from "../../../src/components/app/EpubExportSettingsDialog";
import { PdfExportSettingsDialog } from "../../../src/components/app/PdfExportSettingsDialog";
import "../../../src/styles/index.css";
document.documentElement.dataset.theme = "light";
function Fixture() {
 const [open, setOpen] = useState(true);
 const dialogRef = useRef<HTMLElement>(null), cancelButtonRef = useRef<HTMLButtonElement>(null);
 const common = { bookAvailable: true, dialogRef, cancelButtonRef, documentName: "朝の余白.md", hasUnsavedChanges: true,
   menuLanguage: "ja" as const, onCancel: () => setOpen(false), onConfirm: () => setOpen(false),
   preflightByScope: { document: { chapterCount: 1, checkedImageCount: 0, issues: [], hasUnsavedChanges: true }, book: { chapterCount: 3, checkedImageCount: 0, issues: [], hasUnsavedChanges: true } } };
 if (!open) return <button onClick={() => setOpen(true)}>書き出し表示fixtureを開く</button>;
 return new URLSearchParams(location.search).get("format") === "pdf"
   ? <PdfExportSettingsDialog {...common} initialPreset="standard" />
   : <EpubExportSettingsDialog {...common} initialSettings={{ title: "余白のある暮らし", author: "葉桜編集室", language: "ja" }} />;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
