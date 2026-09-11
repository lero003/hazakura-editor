// 実機指摘⑤（ライトテーマで「改行LF」「文字コード」「開き直す」の文字が見えない）と
// ⑥（開き直すチップをどうするか）の証跡。実コンポーネント StatusBar を、
// アプリと同じ `.app-shell.v3-shell` の中で描く（chrome 面のトークンが効く状態）。
//   ?theme=light|dark|yakou|shokou|edohigan|shinkai|crt   ?dirty=1
// ネイティブ（再読込）は呼ばない。表示だけ。
import React from "react";
import { createRoot } from "react-dom/client";
import { StatusBar } from "../../../src/components/app/StatusBar";
import { getEditorChromeCopy } from "../../../src/lib/locale";
import type { EditorTab } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") ?? "light";
const dirty = params.get("dirty") === "1";
document.documentElement.dataset.theme = theme;

const copy = getEditorChromeCopy("ja");
const tab: EditorTab = {
  contents: "# 朝の余白\n\nことばに、静かなあいだを。\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fixture",
  ignoredExternalFingerprint: null,
  id: "/随筆/chapters/02_朝の余白.md",
  large_file_warning: false,
  lastSavedContents: "# 朝の余白\n\nことばに、静かなあいだを。\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "02_朝の余白.md",
  path: "/随筆/chapters/02_朝の余白.md",
  saveStatus: "idle",
  sessionId: "fixture",
  size: 128,
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <main
    className="app-shell v3-shell"
    style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", height: "100vh" }}
  >
    <div />
    <StatusBar
      activeDirty={dirty}
      activeTab={tab}
      agentLabel={null}
      detail={dirty ? "1,268 文字" : "1,268 文字"}
      secondaryDetail=""
      dirtyLabel={dirty ? "未保存" : ""}
      encodingAriaLabel={copy.encodings}
      encodingChipTitle={copy.encodingChipTitle}
      encodingLabel={copy.encoding}
      encodingReopenBlocked={copy.encodingReopenBlocked}
      encodingReopenGroup={copy.encodingReopenGroup}
      encodingSaveGroup={copy.encodingSaveGroup}
      lineEndingAriaLabel={copy.lineEndings}
      lineEndingLabel={copy.lineEnding}
      lModeEnabled={false}
      onConvertEncoding={() => {}}
      onConvertLineEnding={() => {}}
      onReopenEncoding={() => {}}
      saveAffirmation={false}
      saveAffirmationKey={null}
      statusText={dirty ? "未保存の変更があります" : "保存済み"}
    />
  </main>,
);
