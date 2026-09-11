// 実機指摘⑦（お遊びテーマの演出が本文だけ）の証跡。
// 実コンポーネント（TabBar / WorkspaceTree / StatusBar）を、アプリと同じ
// `.app-shell.v3-shell` の中で描く。WebGL の背景シェーダーはこの確認の対象外
// （テーマごとの実画面はヘッドレスで写らないため、文字演出の有無を見る）。
//   ?theme=crt|shinkai|light
import React from "react";
import { createRoot } from "react-dom/client";
import { TabBar } from "../../../src/components/editor/TabBar";
import { WorkspaceTree } from "../../../src/components/workspace/WorkspaceTree";
import { StatusBar } from "../../../src/components/app/StatusBar";
import { getEditorChromeCopy, getWorkspaceFileOpsCopy } from "../../../src/lib/locale";
import type { WorkspaceTreeEntry } from "../../../src/lib/tauri";
import type { EditorTab } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") ?? "crt";

const noop = () => {};
const fileOps = getWorkspaceFileOpsCopy("ja");
const chrome = getEditorChromeCopy("ja");

const tab: EditorTab = {
  contents: "# 朝の余白\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fixture",
  ignoredExternalFingerprint: null,
  id: "/随筆/chapters/02_朝の余白.md",
  large_file_warning: false,
  lastSavedContents: "# 朝の余白\n",
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

const tree: WorkspaceTreeEntry = {
  children: [
    { children: null, kind: "file", name: "01_はじめに.md", path: "/随筆/chapters/01_はじめに.md" },
    { children: null, kind: "file", name: "02_朝の余白.md", path: "/随筆/chapters/02_朝の余白.md" },
    { children: null, kind: "file", name: "03_散歩の途中で.md", path: "/随筆/chapters/03_散歩の途中で.md" },
  ],
  kind: "directory",
  name: "chapters",
  path: "/随筆/chapters",
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <main
    className="app-shell v3-shell"
    style={{
      display: "grid",
      gridTemplateRows: "min-content auto minmax(0, 1fr) auto",
      height: "100vh",
    }}
  >
    <div className="primary-toolbar-slot">
      <header className="app-primary-toolbar">
        <div className="primary-document-identity">
          <div className="primary-document-name">
            <strong>{tab.name}</strong>
            <small>随筆</small>
          </div>
        </div>
        <div />
        <div className="primary-document-actions">
          <button className="primary-companion" type="button">Local Assist</button>
          <button className="primary-save" type="button">保存</button>
        </div>
      </header>
    </div>
    <TabBar
      activeTabId={tab.id}
      draggingTabId={null}
      dragOverTabId={null}
      emptyTabsLabel="開いているファイルはありません"
      onCloseSelectedImagePreview={noop}
      onCloseTab={noop}
      onFinishTabPointerDrag={noop}
      onPointerEnter={noop}
      onSelectTab={noop}
      onTabContextMenu={noop}
      onTabPointerDown={noop}
      onTabPointerMove={noop}
      openFileTabsLabel="開いているファイルの一覧"
      openFilesLabel="開いているファイル"
      selectedImage={null}
      shouldSuppressTabClick={() => false}
      tabs={[tab]}
    >
      <div className="document-meta" />
    </TabBar>
    <div style={{ display: "grid", gridTemplateColumns: "225px minmax(0, 1fr)", minHeight: 0 }}>
      <aside className="file-tree-pane">
        <div className="workspace-header">
          <div className="workspace-labels">
            <span className="workspace-kicker">ワークスペース</span>
            <span className="workspace-title">随筆</span>
          </div>
        </div>
        <WorkspaceTree
          activePath={tab.path}
          compareSelectionEnabled={false}
          compareSourcePath={null}
          compareTargetPath={null}
          dirtyFilePaths={[]}
          entry={tree}
          loadingLabel="読み込み中…"
          onClearCompareSelection={noop}
          onLoadDirectory={async () => {}}
          onMoveEntry={noop}
          onOpenContextMenu={noop}
          onOpenFile={noop}
          onSelectCompareFile={noop}
          onSubmitRename={noop}
          openFilePaths={[tab.path]}
          openFileStateLabel="開いているファイル"
          partialEntriesLabel={(hiddenCount: number) => `残り${hiddenCount}件`}
          renameLabel="名前を変更"
          renamingPath={null}
          requestRename={noop}
          unsavedOpenFileStateLabel={fileOps.unsavedOpenFileState}
        />
      </aside>
      <div style={{ background: "var(--surface-paper)" }} />
    </div>
    <StatusBar
      activeDirty={false}
      activeTab={tab}
      agentLabel={null}
      detail="1,268 文字"
      secondaryDetail=""
      dirtyLabel=""
      encodingAriaLabel={chrome.encodings}
      encodingChipTitle={chrome.encodingChipTitle}
      encodingLabel={chrome.encoding}
      encodingReopenBlocked={chrome.encodingReopenBlocked}
      encodingReopenGroup={chrome.encodingReopenGroup}
      encodingSaveGroup={chrome.encodingSaveGroup}
      lineEndingAriaLabel={chrome.lineEndings}
      lineEndingLabel={chrome.lineEnding}
      lModeEnabled={false}
      onConvertEncoding={noop}
      onConvertLineEnding={noop}
      onReopenEncoding={noop}
      saveAffirmation={false}
      saveAffirmationKey={null}
      statusText="保存済み"
    />
  </main>,
);
