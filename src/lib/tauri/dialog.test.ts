import { describe, expect, it, vi } from "vitest";
import { pickSaveAsTextFilePath } from "./dialog";

const dialogApi = vi.hoisted(() => ({
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
  open: vi.fn(),
  save: dialogApi.save,
}));

describe("pickSaveAsTextFilePath", () => {
  it("passes common text-extension filters to the native save dialog", async () => {
    dialogApi.save.mockResolvedValueOnce("/tmp/note.log");

    const selected = await pickSaveAsTextFilePath("/tmp/note.md");

    expect(selected).toBe("/tmp/note.log");
    expect(dialogApi.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "/tmp/note.md",
        filters: expect.arrayContaining([
          expect.objectContaining({
            name: "Markdown",
            extensions: expect.arrayContaining(["md", "markdown"]),
          }),
          expect.objectContaining({
            name: "Plain Text",
            extensions: expect.arrayContaining(["txt", "log"]),
          }),
          expect.objectContaining({
            name: "Source / Text",
            extensions: expect.arrayContaining(["md", "log", "ts"]),
          }),
        ]),
      }),
    );
  });

  it("normalizes a text extension appended by the selected filter", async () => {
    dialogApi.save.mockResolvedValueOnce("/tmp/note.log.md");

    const selected = await pickSaveAsTextFilePath("/tmp/note.md");

    expect(selected).toBe("/tmp/note.log");
  });
});
