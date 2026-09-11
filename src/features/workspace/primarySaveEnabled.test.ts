import { describe, expect, it } from "vitest";
import { resolvePrimarySaveEnabled } from "./primarySaveEnabled";

const base = {
  activeDirty: true,
  canNavigate: true,
  pathless: false,
  generationLocked: false,
  readingOverlayOpen: false,
  saveStatus: "idle" as const,
};

describe("resolvePrimarySaveEnabled", () => {
  it("enables saving while the document has unsaved changes", () => {
    expect(resolvePrimarySaveEnabled(base)).toBe(true);
    expect(resolvePrimarySaveEnabled({ ...base, activeDirty: false })).toBe(false);
  });

  it("still allows the first save of an empty new document (R7)", () => {
    // 空の新規文書は dirty ではないが、保存処理側は path なしを Save As へ回す。
    // 入口だけが閉じていると「新規作成したのに保存できない」になる。
    expect(
      resolvePrimarySaveEnabled({ ...base, activeDirty: false, pathless: true }),
    ).toBe(true);
    // 名前が付いた文書で変更が無いときは、従来どおり押せない（空の新規だけの例外）。
    expect(
      resolvePrimarySaveEnabled({ ...base, activeDirty: false, pathless: false }),
    ).toBe(false);
    // 除外条件は path なしでも効く。
    expect(
      resolvePrimarySaveEnabled({
        ...base,
        activeDirty: false,
        pathless: true,
        readingOverlayOpen: true,
      }),
    ).toBe(false);
  });

  it("keeps the existing blocking conditions", () => {
    expect(resolvePrimarySaveEnabled({ ...base, canNavigate: false })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, readingOverlayOpen: true })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, generationLocked: true })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, saveStatus: "saving" })).toBe(false);
    expect(resolvePrimarySaveEnabled({ ...base, saveStatus: null })).toBe(true);
  });
});
