import { describe, expect, it } from "vitest";
import { resolveReaderPagingOwnership } from "./readerKeyboardOwnership";

/**
 * 外部レビュー R1 の回帰条件を行列にする:
 * 読書面内の左右/Space は動く／ダイアログ中は動かない／ペイン境界の矢印で幅だけ変わる／
 * 非表示の読書面は処理しない。既存の契約（本文にフォーカスが残っていてもページ送りする）は
 * 維持するので、発生源が読書面の外であることだけでは止めない。
 */
const base = {
  eventFromOtherKeyOwner: false,
  modalOpen: false,
  readerAvailable: true,
};

describe("resolveReaderPagingOwnership", () => {
  it("lets a visible reader page from inside it or while the editor holds focus", () => {
    expect(resolveReaderPagingOwnership(base)).toBe(true);
  });

  it("does not page while a modal dialog is open", () => {
    // 書き出し・設定・バックアップ・パレットの操作中は背後の読書位置を動かさない
    // （原典の再現: キャンセルボタンにフォーカスして ArrowRight）。
    expect(resolveReaderPagingOwnership({ ...base, modalOpen: true })).toBe(false);
  });

  it("does not take arrow keys from a pane divider", () => {
    // ペイン境界のリサイザは role="separator" で左右矢印に幅の増減を割り当てている。
    expect(
      resolveReaderPagingOwnership({ ...base, eventFromOtherKeyOwner: true }),
    ).toBe(false);
  });

  it("does not page from a hidden or inert reader", () => {
    // 全幅の読書面を開いている間、文書カラム側の同じ読書面は hidden + inert になる。
    // マウントされたまま隠れている読書面が背後のページを動かさないようにする。
    expect(
      resolveReaderPagingOwnership({ ...base, readerAvailable: false }),
    ).toBe(false);
  });
});
