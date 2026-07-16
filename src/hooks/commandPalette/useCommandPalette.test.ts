import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Command } from "./useCommandPalette";
import { useCommandPalette } from "./useCommandPalette";

function command(
  label: string,
  keywords: readonly string[] = ["preview"],
): Command {
  return {
    category: "View",
    id: "view.preview",
    keywords,
    label,
    run: vi.fn(),
  };
}

describe("useCommandPalette", () => {
  it("refreshes visible command labels when locale changes", () => {
    const { result, rerender } = renderHook(
      ({ commands }: { commands: Command[] }) =>
        useCommandPalette({ commands }),
      { initialProps: { commands: [command("Show Preview")] } },
    );

    act(() => {
      result.current.openCommandPalette();
    });
    expect(result.current.filteredCommands[0]?.label).toBe("Show Preview");

    rerender({ commands: [command("プレビューを表示")] });

    expect(result.current.filteredCommands[0]?.label).toBe(
      "プレビューを表示",
    );
  });

  it("reapplies an active query to replacement commands", () => {
    const { result, rerender } = renderHook(
      ({ commands }: { commands: Command[] }) =>
        useCommandPalette({ commands }),
      { initialProps: { commands: [command("Show Preview")] } },
    );

    act(() => {
      result.current.openCommandPalette();
      result.current.setQuery("preview");
    });
    expect(result.current.filteredCommands).toHaveLength(1);

    rerender({ commands: [command("Outline", ["headings"])] });

    expect(result.current.filteredCommands).toEqual([]);
  });

  it("does not run or close when a command has disabledReason", () => {
    const run = vi.fn();
    const disabled: Command = {
      category: "File",
      disabledReason: "Open a document first.",
      id: "file.save",
      label: "Save",
      run,
    };
    const { result } = renderHook(() =>
      useCommandPalette({ commands: [disabled] }),
    );

    act(() => {
      result.current.openCommandPalette();
    });
    expect(result.current.commandPaletteVisible).toBe(true);

    act(() => {
      result.current.runCommand(disabled);
    });

    expect(run).not.toHaveBeenCalled();
    expect(result.current.commandPaletteVisible).toBe(true);
  });

  it("runs enabled commands and closes the palette", () => {
    const run = vi.fn();
    const enabled: Command = {
      category: "View",
      id: "view.preview",
      label: "Show Preview",
      run,
    };
    const { result } = renderHook(() =>
      useCommandPalette({ commands: [enabled] }),
    );

    act(() => {
      result.current.openCommandPalette();
      result.current.runCommand(enabled);
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.commandPaletteVisible).toBe(false);
  });
});
