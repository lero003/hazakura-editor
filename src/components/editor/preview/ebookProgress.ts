/**
 * 読書面の進捗表示（画面04・レビューR4）。
 *
 * ページ数は「計測済みか」と「何ページか」を分けて扱う。件数だけを見ると、
 * 初期値の1と「1ページの章」が区別できず、未計測なのに `1 / 1` と言い切って
 * しまう。ここで表示と ARIA の契約を1箇所にまとめ、未計測の間は
 * **値を主張しない**（`aria-valuenow` を出さない）ことを保証する。
 */
export type EBookProgressInput = {
  /** この章のページ数を計測できたか。 */
  measured: boolean;
  /** 0-based の現在ページ。 */
  pageIndex: number;
  /** 計測済みページ数（未計測のときは何でもよい）。 */
  pageCount: number;
};

export type EBookProgressCopy = {
  pageProgress: string;
  footerPageProgress: string;
  pageProgressUnknown: string;
};

/** 未計測は推測せず、数えていることを伝える文字だけを出す。 */
export function ebookProgressText(
  input: EBookProgressInput,
  copy: EBookProgressCopy,
  place: "header" | "footer",
): string {
  if (!input.measured) return copy.pageProgressUnknown;
  const label = place === "header" ? copy.pageProgress : copy.footerPageProgress;
  const total = Math.max(1, input.pageCount);
  return `${label} ${input.pageIndex + 1} / ${total}`;
}

/** バーの塗り（%）。未計測は 0 のまま（不定を可視化しない）。 */
export function ebookProgressPercent(input: EBookProgressInput): number {
  if (!input.measured) return 0;
  const total = Math.max(1, input.pageCount);
  return Math.min(100, ((input.pageIndex + 1) / total) * 100);
}

/**
 * 範囲ウィジェットの ARIA。未計測は `aria-valuenow` を**出さず**、説明だけを出す
 * （W3C APG の不定の進捗の扱い）。計測済みは min=0 にして、視覚の割合
 * `(現在+1)/総` と ARIA の割合を一致させる。
 */
export function ebookProgressAria(
  input: EBookProgressInput,
  copy: EBookProgressCopy,
): Record<string, number | string> {
  if (!input.measured) return { "aria-valuetext": copy.pageProgressUnknown };
  const total = Math.max(1, input.pageCount);
  return {
    "aria-valuemin": 0,
    "aria-valuemax": total,
    "aria-valuenow": Math.min(total, input.pageIndex + 1),
  };
}
