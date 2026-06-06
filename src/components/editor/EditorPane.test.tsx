import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEditorWrappingExtensions } from "./EditorPane";
import EditorPane from "./EditorPane";
import { getLModeCopy, getSlashMenuCopy } from "../../lib/locale";

afterEach(cleanup);

describe("getEditorWrappingExtensions", () => {
  it("forces line wrapping in L Mode even when normal wrapping is off", () => {
    expect(getEditorWrappingExtensions(false, false)).toHaveLength(0);
    expect(getEditorWrappingExtensions(true, false).length).toBeGreaterThan(0);
    expect(getEditorWrappingExtensions(false, true).length).toBeGreaterThan(0);
  });
});

describe("EditorPane", () => {
  it("mounts a restored markdown document", () => {
    const { container } = render(
      <EditorPane
        activeSearchMatchIndex={-1}
        documentKey="/workspace/note.md"
        fontSize={15}
        lModeCopy={getLModeCopy("en")}
        lModeEnabled={false}
        onChange={vi.fn()}
        onScrollRatioChange={vi.fn()}
        onSelectionChange={vi.fn()}
        searchMatches={[]}
        showInvisibles={false}
        slashCommands={[]}
        slashMenuCopy={getSlashMenuCopy("en")}
        spellcheckEnabled={true}
        tabSize={2}
        theme="light"
        value="# Note\n\nRestored."
        wrapLines={true}
      />,
    );

    expect(container.querySelector(".editor-mount")).not.toBeNull();
  });
});
