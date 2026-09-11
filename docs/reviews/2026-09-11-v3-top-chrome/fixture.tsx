// 実機指摘①（二段目の「確認」重複）・③（左上の左ペイン開閉ボタン）・⑨（保存ボタンの
// 押せる条件）の証跡。実コンポーネント（AppPrimaryToolbar / DocumentMetaBar）を、
// アプリと同じ `.app-shell.v3-shell` と `.tabs-row` の中で描く。表示だけ。
//   ?theme=light|dark   ?dirty=0|1
import React from "react";
import { createRoot } from "react-dom/client";
import { AppPrimaryToolbar } from "../../../src/components/app/AppPrimaryToolbar";
import { DocumentMetaBar } from "../../../src/components/app/DocumentMetaBar";
import { EditorQuickSettingsMenu } from "../../../src/components/app/EditorQuickSettingsMenu";
import { resolvePrimarySaveEnabled } from "../../../src/features/workspace/primarySaveEnabled";
import { getLModeCopy, getSidePaneCopy } from "../../../src/lib/locale";
import { defaultEditorSettings } from "../../../src/lib/editorSettingsDefaults";
import type { EditorTab } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") ?? "light";
const dirty = params.get("dirty") === "1";
document.documentElement.dataset.theme = theme;

const tab: EditorTab = {
  contents: "# 朝の余白\n\nことばに、静かなあいだを。\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fixture",
  ignoredExternalFingerprint: null,
  id: "/随筆/chapters/02_朝の余白.md",
  large_file_warning: false,
  lastSavedContents: dirty ? "saved" : "# 朝の余白\n\nことばに、静かなあいだを。\n",
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

const noop = () => {};

createRoot(document.getElementById("root") as HTMLElement).render(
  <main
    className="app-shell v3-shell"
    style={{
      display: "grid",
      gridTemplateRows: "auto min-content minmax(0, 1fr) auto",
      height: "100vh",
    }}
  >
    <div className="primary-toolbar-slot">
      <AppPrimaryToolbar
        assistSurfaceActive="none"
        agentWorkbenchAvailable={false}
        canSave={resolvePrimarySaveEnabled({
          activeDirty: dirty,
          canNavigate: true,
          generationLocked: false,
          readingOverlayOpen: false,
          saveStatus: tab.saveStatus,
        })}
        documentName={tab.name}
        menuLanguage="ja"
        navigation={{
          canNavigate: true,
          documentName: tab.name,
          menuLanguage: "ja",
          mode: "write",
          onRead: noop,
          onReview: noop,
          onWrite: noop,
          reviewTargets: dirty ? ["disk"] : [],
        }}
        onOpenAgentWindow={noop}
        onOpenAppleAssistWindow={noop}
        onSave={noop}
        saving={false}
        sidePaneCopy={getSidePaneCopy("ja")}
        workspaceName="随筆"
      />
    </div>
    <section className="tabs-row lmode-surface" aria-label="開いているファイル">
      <div aria-hidden="true" className="window-drag-strip" />
      <EditorQuickSettingsMenu
        editorSettings={defaultEditorSettings()}
        menuLanguage="ja"
        onEditorSettingsChange={noop}
      />
      <div className="tab-list" role="tablist" aria-label="開いているファイルの一覧">
        <div className="tab-item active" role="presentation">
          <button aria-selected="true" className="tab-button" role="tab" type="button">
            {tab.name}
          </button>
        </div>
      </div>
      <DocumentMetaBar
        activeTab={tab}
        agentWorkbenchAvailable={false}
        assistSurfaceActive="none"
        diffPaneActive={false}
        ebookAvailable
        ebookPaneActive={false}
        lModeCopy={getLModeCopy("ja")}
        lModeEnabled={false}
        onOpenAgentWindow={noop}
        onOpenAppleAssistWindow={noop}
        onToggleDiff={noop}
        onToggleEbook={noop}
        onToggleLMode={noop}
        onToggleOutline={noop}
        onTogglePreview={noop}
        onToggleReference={noop}
        outlinePaneActive={false}
        previewPaneActive
        referencePaneActive={false}
        sidePaneCopy={getSidePaneCopy("ja")}
      />
    </section>
    <div style={{ background: "var(--surface-paper)" }} />
  </main>,
);
