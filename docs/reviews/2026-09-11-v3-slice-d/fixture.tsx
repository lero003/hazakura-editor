// 画面14（保存の衝突）と画面24（画像プレビュー）の実コンポーネントを、
// ローカル状態だけで描く。ネイティブ境界（get_file_metadata）だけを差し替えて、
// 実装と同じコード経路で「実データ」の表示を確認する。
//   ?screen=conflict|image   ?theme=light|dark|edohigan
import React from "react";
import { createRoot } from "react-dom/client";
import { SaveConflictDialog } from "../../../src/components/app/SaveConflictDialog";
import { ImagePreviewPane } from "../../../src/components/editor/preview/ImagePreviewPane";
import type { EditorTab, ThemePreference } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const screen = params.get("screen") ?? "conflict";
document.documentElement.dataset.theme = (params.get("theme") ?? "light") as ThemePreference;

// ネイティブ境界のスタブ（UIではなく invoke を差し替える）。
(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
  invoke: async (command: string, args?: { path?: string }) => {
    if (command === "get_file_metadata") {
      return {
        path: args?.path ?? "",
        size: 4173,
        modified_ms: Date.parse("2026-09-11T12:41:00+09:00"),
        fingerprint: "fp-external",
        large_file_warning: false,
      };
    }
    throw new Error(`unexpected command: ${command}`);
  },
};

const tab = {
  id: "/workspace/02_朝の余白.md",
  sessionId: "session:fixture",
  name: "02_朝の余白.md",
  path: "/workspace/02_朝の余白.md",
  contents: "あ".repeat(1268),
  lastSavedContents: "あ".repeat(1200),
  line_ending: "lf",
  encoding: "utf-8",
  lastSavedLineEnding: "lf",
  lastSavedEncoding: "utf-8",
  size: 1200,
  modified_ms: null,
  fingerprint: "fp-disk",
  externalFingerprint: "fp-external",
  ignoredExternalFingerprint: null,
  saveStatus: "conflict",
  error: null,
  large_file_warning: false,
} as EditorTab;

const image = {
  path: "/workspace/assets/morning-sketch.png",
  name: "morning-sketch.png",
  url: "/assets/5fd5d7d9c38128d4.png",
  size: 671093,
};

function Fixture() {
  return screen === "image"
    ? <ImagePreviewPane image={image} title="画像" menuLanguage="ja" workspaceRootPath="/workspace" />
    : <SaveConflictDialog tab={tab} menuLanguage="ja" onBack={() => {}} onCompare={() => {}} onSaveAs={() => {}} />;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
