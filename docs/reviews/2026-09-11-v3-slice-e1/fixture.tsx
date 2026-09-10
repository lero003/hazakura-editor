// 画面09（検索）・10（構造のヒント）・11（書き出し）の実コンポーネントを
// ローカルデータだけで描く。ネイティブ（フォルダ選択・保存先）は呼び出さない。
//   ?screen=search|outline|export   ?theme=light|dark
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalSearch } from "../../../src/components/globalSearch/GlobalSearch";
import { OutlinePane } from "../../../src/components/editor/OutlinePane";
import { HtmlExportSettingsDialog } from "../../../src/components/app/HtmlExportSettingsDialog";
import { markdownStructureItems, parseMarkdownStructure } from "../../../src/features/editor/markdownStructure";
import { analyzeMarkdownStructure } from "../../../src/features/editor/markdownStructureAdvisories";
import { getSidePaneCopy } from "../../../src/lib/locale";
import type { ThemePreference } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const screen = params.get("screen") ?? "search";
document.documentElement.dataset.theme = (params.get("theme") ?? "light") as ThemePreference;

const SOURCE = ["# 第一章", "", "朝の余白について書く。", "", "### 章の途中", "", "余白は、ことばの呼吸です。", "", "## 第二章", "", "春の訪れを待つ。"].join("\n");

function SearchFixture() {
  const match = (line: number, column: number, text: string) => ({ line, column, text });
  const file = { path: "/w/02.md", relativePath: "notes/02_朝の余白.md", truncated: false,
    // column は backend と同じ「一致の開始位置（1始まり）」。
    matches: [match(3, 3, "朝の余白について書く。"), match(7, 1, "余白は、ことばの呼吸です。")] };
  const other = { path: "/w/03.md", relativePath: "notes/03_春.md", truncated: false, matches: [match(2, 1, "余白という言葉は静かです。")] };

  const rows = [
    { fileIndex: 0, matchIndex: 0, file, match: file.matches[0] },
    { fileIndex: 0, matchIndex: 1, file, match: file.matches[1] },
    { fileIndex: 1, matchIndex: 0, file: other, match: other.matches[0] },
  ];
  return <div style={{ padding: 24 }}>
    <GlobalSearch activeIndex={0} menuLanguage="ja" onClose={() => {}} onRun={() => {}}
      onSetActiveIndex={() => {}} onSetQuery={() => {}} query="余白" rows={rows} searching={false}
      summary={{ totalFilesScanned: 7, totalMatches: 3, totalFilesMatched: 2, truncated: false }}
      searchError={null} workspaceOpen workspaceName="原稿フォルダ" />
  </div>;
}

function OutlineFixture() {
  const structure = parseMarkdownStructure(SOURCE);
  return <div style={{ padding: 24, width: 360 }}>
    <OutlinePane copy={getSidePaneCopy("ja")} currentHeadingLine={1}
      advisories={analyzeMarkdownStructure(SOURCE, structure)}
      items={markdownStructureItems(structure)} onChangeHeadingLevel={() => {}} onSelect={() => {}} truncated={false} />
  </div>;
}

function ExportFixture() {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  return <div style={{ padding: 24 }}>
    <HtmlExportSettingsDialog request={{ documentName: "02_朝の余白.md", hasUnsavedChanges: true } as never}
      menuLanguage="ja" dialogRef={dialogRef} cancelButtonRef={cancelButtonRef}
      onConfirm={() => {}} onCancel={() => {}} />
  </div>;
}

createRoot(document.getElementById("root")!).render(
  screen === "outline" ? <OutlineFixture /> : screen === "export" ? <ExportFixture /> : <SearchFixture />,
);
