import { describe, expect, it } from "vitest";
import { isImportAssistSourceFile } from "./utils";

describe("isImportAssistSourceFile", () => {
  it("accepts PDF and common image extensions", () => {
    expect(isImportAssistSourceFile("note.PDF")).toBe(true);
    expect(isImportAssistSourceFile("/ws/docs/scan.png")).toBe(true);
    expect(isImportAssistSourceFile("photo.JPEG")).toBe(true);
    expect(isImportAssistSourceFile("raw.heic")).toBe(true);
  });

  it("rejects markdown and unsupported types", () => {
    expect(isImportAssistSourceFile("readme.md")).toBe(false);
    expect(isImportAssistSourceFile("shot.webp")).toBe(false);
    expect(isImportAssistSourceFile("archive")).toBe(false);
  });
});
