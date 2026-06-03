import { describe, expect, it } from "vitest";
import { getEditorWrappingExtensions } from "./EditorPane";

describe("getEditorWrappingExtensions", () => {
  it("forces line wrapping in L Mode even when normal wrapping is off", () => {
    expect(getEditorWrappingExtensions(false, false)).toHaveLength(0);
    expect(getEditorWrappingExtensions(true, false).length).toBeGreaterThan(0);
    expect(getEditorWrappingExtensions(false, true).length).toBeGreaterThan(0);
  });
});
