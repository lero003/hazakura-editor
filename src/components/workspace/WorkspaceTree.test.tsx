import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { WorkspaceTree } from "./WorkspaceTree";
import type { WorkspaceTreeEntry } from "../../lib/tauri";

afterEach(cleanup);

const rootPath = "/workspace";
const sourcePath = `${rootPath}/source/note.md`;
const destPath = `${rootPath}/dest`;
const internalMoveMime = "application/x-hazakura-workspace-move";

function entry(
  name: string,
  path: string,
  kind: WorkspaceTreeEntry["kind"],
  children: WorkspaceTreeEntry[] = [],
): WorkspaceTreeEntry {
  return {
    children,
    children_loaded: true,
    children_truncated: false,
    kind,
    name,
    path,
  };
}

function makeTree(): WorkspaceTreeEntry {
  return entry("workspace", rootPath, "directory", [
    entry("source", `${rootPath}/source`, "directory", [
      entry("note.md", sourcePath, "file"),
    ]),
    entry("dest", destPath, "directory"),
  ]);
}

function makeDataTransfer(path: string): DataTransfer {
  return {
    dropEffect: "move",
    effectAllowed: "copyMove",
    getData: vi.fn((type: string) =>
      type === internalMoveMime ? path : "",
    ),
    setData: vi.fn(),
    types: [internalMoveMime],
  } as unknown as DataTransfer;
}

function renderTree(onMoveEntry = vi.fn()) {
  const view = render(
    <WorkspaceTree
      activePath={null}
      compareSelectionEnabled={false}
      compareSourcePath={null}
      compareTargetPath={null}
      entry={makeTree()}
      onLoadDirectory={vi.fn(async () => undefined)}
      onMoveEntry={onMoveEntry}
      onOpenContextMenu={vi.fn()}
      onOpenFile={vi.fn()}
      onSelectCompareFile={vi.fn()}
      onSubmitRename={vi.fn()}
      renamingPath={null}
      requestRename={vi.fn()}
    />,
  );
  return { onMoveEntry, view };
}

describe("WorkspaceTree", () => {
  it("drops a workspace entry onto only the target directory", () => {
    const { onMoveEntry, view } = renderTree();
    const destButton = view.container.querySelector(
      `button[title="${destPath}"]`,
    );
    const destDirectory = destButton?.closest(".tree-directory");

    expect(destDirectory).toBeTruthy();

    fireEvent.drop(destDirectory as Element, {
      dataTransfer: makeDataTransfer(sourcePath),
    });

    expect(onMoveEntry).toHaveBeenCalledTimes(1);
    expect(onMoveEntry).toHaveBeenCalledWith(sourcePath, destPath);
  });
});
