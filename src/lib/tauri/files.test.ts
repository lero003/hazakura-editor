import { describe, expect, it, vi } from "vitest";
import { saveBinaryFileAs } from "./files";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("saveBinaryFileAs", () => {
  it("sends binary contents as base64 instead of a JSON number array", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await saveBinaryFileAs(
      "/tmp/book.epub",
      new Uint8Array([0, 1, 2, 253, 254, 255]),
    );

    expect(invoke).toHaveBeenCalledWith("save_binary_file_as", {
      path: "/tmp/book.epub",
      contentsBase64: "AAEC/f7/",
    });
  });
});
