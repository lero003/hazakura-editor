/**
 * 電子書籍のページ送りキーを、その読書面が持ってよいかの判定（外部レビュー R1）。
 *
 * 読書面は `document` の capture で左右矢印と Space を拾っている。これは本文（エディタ）と
 * 兄弟でフォーカスが本文に残ることがあるためで、「ペインを開いている間は読書面がキーを持つ」
 * という既存の契約はそのまま残す。足りなかったのは次の3つで、以前はどれも見ていなかった:
 *
 * 1. **モーダルが開いている**（書き出し・設定・バックアップ・パレット等）——
 *    ダイアログのボタンにフォーカスしたまま左右矢印を押すと背後のページが送られていた。
 * 2. **自分のキーを持つ面からのイベント**（ペイン境界のリサイザは `role="separator"` で
 *    左右矢印に幅の増減を割り当てている）。capture で先に取ると幅が変わらない。
 * 3. **非表示・`inert`・`aria-hidden` の下にある読書面**（全幅の読書面を開いている間、
 *    文書カラム側の同じ読書面は `hidden` + `inert` になる）。
 *
 * ここは判定だけを持つ純関数。DOM の読み取りは呼び出し側（EBookPane）が行う。
 * レビューの回帰条件は「読書面内の左右/Space は動く／ダイアログ中は動かない／
 * ペイン境界の矢印で幅だけ変わる／非表示の読書面は処理しない／IME と修飾キーを妨げない」。
 */
export function resolveReaderPagingOwnership(input: {
  /** キーの発生源が、自分のキーを持つ別の面（リサイザ等）か。 */
  eventFromOtherKeyOwner: boolean;
  /** モーダル（書き出し・設定・バックアップ・パレット等）が開いているか。 */
  modalOpen: boolean;
  /** この読書面が入力を持ってよい状態か（非表示・inert・aria-hidden の下でない）。 */
  readerAvailable: boolean;
}): boolean {
  if (!input.readerAvailable || input.modalOpen || input.eventFromOtherKeyOwner) {
    return false;
  }
  return true;
}

/** ページ送りキーを奪ってはいけない面（自分のキー操作を持つ）のセレクタ。 */
export const READER_KEY_OWNER_SELECTOR = '[role="separator"]';

/** 読書面がキーを奪ってはいけないモーダル面のセレクタ。 */
export const READER_MODAL_SELECTOR =
  '.modal-backdrop, [aria-modal="true"], [role="dialog"]';
