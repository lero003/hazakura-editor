// サイドバー下端（新しい「フォルダ内を検索」＋ゴミ箱）の実描画フィクスチャ。
// 実コンポーネント `WorkspaceSidebar` を、実データだけ差し替えて描く（UIは作り直さない）。
import React from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceSidebar } from "../../../src/components/workspace/WorkspaceSidebar";
import { getSafeEditorCopy, getWorkspaceFileOpsCopy } from "../../../src/lib/locale";
import type { WorkspaceTreeEntry } from "../../../src/lib/tauri";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") ?? "light";

const file = (name: string): WorkspaceTreeEntry => ({
  children: [],
  children_loaded: true,
  children_truncated: false,
  kind: "file",
  name,
  path: `/workspace/${name}`,
});

const workspaceTree: WorkspaceTreeEntry = {
  children: [
    {
      children: [file("01_はじめに.md"), file("02_朝の余白.md")],
      children_loaded: true,
      children_truncated: false,
      kind: "directory",
      name: "chapters",
      path: "/workspace/chapters",
    },
    file("notes.md"),
    file("README.md"),
  ],
  children_loaded: true,
  children_truncated: false,
  kind: "directory",
  name: "workspace",
  path: "/workspace",
};

const noop = () => {};
const copy = getSafeEditorCopy(params.get("language") === "kana" ? "kana" : "ja");

createRoot(document.getElementById("root") as HTMLElement).render(
  // 実機と同じ幅（225px）で見るための枠。
  <div className="app-shell v3-shell" style={{ height: "100vh", width: 225 }}>
    <WorkspaceSidebar
      activePath="/workspace/chapters/02_朝の余白.md"
      compareSelectionEnabled={false}
      compareSourcePath={null}
      compareTargetPath={null}
      copy={copy}
      dirtyFilePaths={[]}
      fileOpsCopy={getWorkspaceFileOpsCopy("ja")}
      onClearCompareSelection={noop}
      onCollapse={undefined}
      onCreateFile={noop}
      onCreateFolder={noop}
      onCreateOkfScaffoldBookLike={noop}
      onCreateOkfScaffoldMinimal={noop}
      onLoadDirectory={async () => {}}
      onMoveEntry={noop}
      onMoveToTrash={noop}
      onOpenContextMenu={noop}
      onOpenFile={noop}
      onOpenGlobalSearch={noop}
      onOpenRootContextMenu={noop}
      onOpenWorkspace={noop}
      onSelectCompareFile={noop}
      onSubmitRename={noop}
      openFilePaths={["/workspace/chapters/02_朝の余白.md"]}
      renamingPath={null}
      requestRename={noop}
      workspaceRootPath="/workspace"
      workspaceTree={workspaceTree}
    />
  </div>,
);