import { describe, expect, it } from "vitest";
import { resolvePrimarySaveEnabled } from "./primarySaveEnabled";

const base = {
  activeDirty: true,
  canNavigate: true,
  generationLocked: false,
  readingOverlayOpen: false,
  saveStatus: "idle" as const,
};

describe("resolvePrimarySaveEnabled", () => {
  it("enables saving only while the document has unsaved changes", () => {
    expect(resolvePrimarySaveEnabled(base)).toBe(true);
    expect(resolvePrimarySaveEnabled({ ...base, activeDirty: false })).toBe(false);
  });

  it("keeps the existing blocking conditions", () => {
    expect(resolvePrimarySaveEnabled({ ...base, canNavigate: false })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, readingOverlayOpen: true })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, generationLocked: true })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, saveStatus: "saving" })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, saveStatus: null })).toBe(true);
  });
});
