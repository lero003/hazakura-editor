import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabContextMenu } from "./TabContextMenu";

describe("TabContextMenu", () => {
  it("opens the selected tab beside the editor as a reference", () => {
    const onOpenAsReference = vi.fn();

    render(
      <TabContextMenu
        anchor={{ path: "/workspace/notes.md", x: 10, y: 10 }}
        menuLanguage="ja"
        onClose={vi.fn()}
        onOpenAsReference={onOpenAsReference}
        onRename={vi.fn()}
        openAsReferenceLabel="参照として横に開く"
      />,
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "参照として横に開く" }),
    );

    expect(onOpenAsReference).toHaveBeenCalledTimes(1);
  });
});
