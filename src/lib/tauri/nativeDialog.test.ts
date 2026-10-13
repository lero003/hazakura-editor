import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirm, open, save } from "./nativeDialog";

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: ipc.invoke }));

beforeEach(() => ipc.invoke.mockReset());

describe("native dialog IPC contract", () => {
  it("opens with empty options and preserves cancellation", async () => {
    ipc.invoke.mockResolvedValueOnce(null);
    await expect(open()).resolves.toBeNull();
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|open", { options: {} });
  });

  it("passes file and folder selection options without rewriting paths or filters", async () => {
    const options = {
      title: "原稿を選択",
      defaultPath: "/tmp/原稿.md",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      multiple: true,
      directory: true,
      recursive: false,
      canCreateDirectories: false,
    };
    const selected = ["/tmp/原稿.md", "/tmp/別稿.markdown"];
    ipc.invoke.mockResolvedValueOnce(selected);
    await expect(open(options)).resolves.toEqual(selected);
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|open", { options });
    expect(Object.isFrozen(options)).toBe(true);
    expect(Object.isFrozen(options.filters)).toBe(false);
  });

  it("preserves the single selected path", async () => {
    ipc.invoke.mockResolvedValueOnce("/tmp/原稿.txt");
    await expect(open({ directory: false, multiple: false })).resolves.toBe("/tmp/原稿.txt");
  });

  it("saves with empty options and preserves cancellation", async () => {
    ipc.invoke.mockResolvedValueOnce(null);
    await expect(save()).resolves.toBeNull();
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|save", { options: {} });
  });

  it("passes save options without appending or stripping extensions", async () => {
    const options = {
      title: "本を書き出す",
      defaultPath: "/tmp/本.hazakura-book.json",
      filters: [{ name: "Book", extensions: ["json"] }],
      canCreateDirectories: true,
    };
    ipc.invoke.mockResolvedValueOnce("/tmp/本.hazakura-book.json.json");
    await expect(save(options)).resolves.toBe("/tmp/本.hazakura-book.json.json");
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|save", { options });
    expect(Object.isFrozen(options)).toBe(true);
  });

  it.each(["Ok", "Cancel", "Yes", "", null])("confirms only an exact Ok result: %s", async (result) => {
    ipc.invoke.mockResolvedValueOnce(result);
    await expect(confirm("変更を破棄しますか？")).resolves.toBe(result === "Ok");
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|message", {
      message: "変更を破棄しますか？", title: undefined, kind: undefined, buttons: "OkCancel",
    });
  });

  it("preserves title and severity for the existing confirmation flows", async () => {
    ipc.invoke.mockResolvedValueOnce("Ok");
    await expect(confirm("通信しますか？", { title: "画像を固定", kind: "warning" })).resolves.toBe(true);
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|message", {
      message: "通信しますか？", title: "画像を固定", kind: "warning", buttons: "OkCancel",
    });
  });

  it("accepts a string title without changing the default buttons", async () => {
    ipc.invoke.mockResolvedValueOnce("Cancel");
    await expect(confirm("続けますか？", "確認")).resolves.toBe(false);
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|message", {
      message: "続けますか？", title: "確認", kind: undefined, buttons: "OkCancel",
    });
  });

  it.each([
    [{ okLabel: "採用", cancelLabel: "戻る" }, ["採用", "戻る"], "採用", true],
    [{ okLabel: "採用" }, ["採用", "Cancel"], "Cancel", false],
    [{ cancelLabel: "戻る" }, ["Ok", "戻る"], "Ok", true],
    [{ okLabel: "", cancelLabel: "戻る" }, ["", "戻る"], "", true],
  ] as const)("preserves custom confirmation labels: %j", async (options, labels, result, accepted) => {
    ipc.invoke.mockResolvedValueOnce(result);
    await expect(confirm("続けますか？", options)).resolves.toBe(accepted);
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|message", {
      message: "続けますか？", title: undefined, kind: undefined,
      buttons: { OkCancelCustom: [...labels] },
    });
  });

  it("retains the upstream empty-label default-button semantics", async () => {
    ipc.invoke.mockResolvedValueOnce("Ok");
    await expect(confirm("続けますか？", { okLabel: "", cancelLabel: "" })).resolves.toBe(false);
    expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith("plugin:dialog|message", {
      message: "続けますか？", title: undefined, kind: undefined, buttons: "OkCancel",
    });
  });

  it.each(["open", "save", "confirm"] as const)("propagates %s IPC permission failures", async (operation) => {
    const failure = new Error("dialog permission denied");
    ipc.invoke.mockRejectedValueOnce(failure);
    const request = operation === "open" ? open() : operation === "save" ? save() : confirm("続けますか？");
    await expect(request).rejects.toBe(failure);
    expect(ipc.invoke).toHaveBeenCalledTimes(1);
  });
});
