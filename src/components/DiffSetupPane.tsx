import type { CompareAnchor, MenuLanguage } from "../types";
import { DiffSelectionSlot } from "./DiffSelectionSlot";

export function DiffSetupPane({
  compareSource,
  compareTarget,
  menuLanguage,
  onClearSource,
  onClearTarget,
  onCompare,
  workspaceRootPath,
}: {
  compareSource: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  menuLanguage: MenuLanguage;
  onClearSource: () => void;
  onClearTarget: () => void;
  onCompare: () => void;
  workspaceRootPath: string | null;
}) {
  const labels =
    menuLanguage !== "en"
      ? {
          clear: "解除",
          compare: "比較する",
          compareSource: "比較元",
          compareTarget: "比較先",
          introText:
            "ワークスペースから2つのテキストファイルを選んで比較します。",
          heading: "Diff",
          noWorkspace:
            "ワークスペースを開くと、左のファイル一覧から比較元と比較先を選べます。",
          openWorkspaceHint: "先にワークスペースフォルダを開いてください",
          sourceHint: "1つ目のファイルを左の一覧から選ぶと比較元になります",
          sourceSelectedHint: "比較元を変更する場合は解除して選び直します",
          targetHint: "2つ目のファイルを左の一覧から選ぶと比較先になります",
          targetSelectedHint: "比較先を変更する場合は解除して選び直します",
          ready:
            "準備完了です。比較するボタンで結果を表示します。",
          sourcePending: "まず左のファイル一覧から比較元を選んでください。",
          targetPending:
            "次に左のファイル一覧から比較先を選んでください。",
          noWorkspacePending:
            "ワークスペースを開くとファイル比較を始められます。",
          sameFilePending:
            "比較元と比較先には別のファイルを選んでください。",
          sourceUnset: "比較元は未選択です",
          targetUnset: "比較先は未選択です",
        }
      : {
          clear: "Clear",
          compare: "Compare",
          compareSource: "Compare source",
          compareTarget: "Compare target",
          introText:
            "Choose two workspace text files and compare them.",
          heading: "Diff",
          noWorkspace:
            "Open a workspace folder to choose the source and target from the left file list.",
          openWorkspaceHint: "Open a workspace folder first",
          sourceHint: "Choose the first file from the left list as the source",
          sourceSelectedHint: "Clear the source to choose a different file",
          targetHint: "Choose the second file from the left list as the target",
          targetSelectedHint: "Clear the target to choose a different file",
          ready:
            "Ready. Use Compare to show the result.",
          sourcePending: "Choose a compare source from the left file list first.",
          targetPending: "Next, choose a compare target from the left file list.",
          noWorkspacePending:
            "Open a workspace folder to start comparing files.",
          sameFilePending: "Choose two different files to compare.",
          sourceUnset: "No compare source selected",
          targetUnset: "No compare target selected",
        };
  const workspaceAvailable = workspaceRootPath !== null;
  const sourceName = compareSource?.name ?? null;
  const sourcePath = compareSource?.path ?? null;
  const targetName = compareTarget?.name ?? null;
  const targetPath = compareTarget?.path ?? null;
  const canCompare =
    compareSource !== null &&
    compareTarget !== null &&
    compareSource.path !== compareTarget.path;
  const sourcePrompt = !workspaceAvailable
    ? labels.openWorkspaceHint
    : compareSource
      ? labels.sourceSelectedHint
      : labels.sourceHint;
  const targetPrompt = !workspaceAvailable
    ? labels.openWorkspaceHint
    : compareTarget
      ? labels.targetSelectedHint
      : labels.targetHint;
  const actionHint = !workspaceAvailable
    ? labels.noWorkspacePending
    : compareSource === null
      ? labels.sourcePending
      : compareTarget === null
        ? labels.targetPending
        : compareSource.path === compareTarget.path
          ? labels.sameFilePending
          : labels.ready;

  return (
    <div className="diff-setup-pane">
      <div className="diff-setup-card">
        <span>{labels.heading}</span>
        <strong>{labels.introText}</strong>
        {!workspaceAvailable ? (
          <p className="diff-setup-note">{labels.noWorkspace}</p>
        ) : null}
        <div className="diff-slots">
          <DiffSelectionSlot
            clearLabel={labels.clear}
            emptyLabel={labels.sourceUnset}
            fileName={sourceName}
            filePath={sourcePath}
            label={labels.compareSource}
            onClear={onClearSource}
            prompt={sourcePrompt}
          />
          <DiffSelectionSlot
            clearLabel={labels.clear}
            emptyLabel={labels.targetUnset}
            fileName={targetName}
            filePath={targetPath}
            label={labels.compareTarget}
            onClear={onClearTarget}
            prompt={targetPrompt}
          />
        </div>
        <div className="diff-setup-actions">
          <button type="button" onClick={onCompare} disabled={!canCompare}>
            {labels.compare}
          </button>
          <p>{actionHint}</p>
        </div>
      </div>
    </div>
  );
}
