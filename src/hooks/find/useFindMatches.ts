import { useMemo } from "react";
import type { SearchOptions, TextMatch } from "../../types";

type UseFindMatchesOptions = {
  options: SearchOptions;
  query: string;
  source: string;
};

export function useFindMatches({
  options,
  query,
  source,
}: UseFindMatchesOptions) {
  const findMatches = useMemo(
    () => findTextMatches(source, query, options),
    [source, query, options],
  );
  const invalidRegex =
    options.regex && query.trim().length > 0 ? !canCompileRegex(query) : false;

  return {
    findMatches,
    invalidRegex,
  };
}

// 純関数としてエクスポートする（検索範囲が置換トランザクションへ渡る経路を
// EditorPane のテストから直接固定するため）。
export function findTextMatches(
  source: string,
  query: string,
  options: SearchOptions,
): TextMatch[] {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  if (options.regex) {
    return findRegexMatches(source, normalizedQuery, options);
  }

  return findLiteralMatches(source, normalizedQuery, options);
}

// 大小文字を無視する検索も「原文の上」で行う。検索語と本文を小文字化して
// indexOf で探すと、小文字化で UTF-16 長が変わる文字（例: İ U+0130 →
// "i" + U+0307）より後ろの位置が本文とずれ、ハイライトだけでなく
// 置換範囲そのものが食い違う（本文を壊す）。原文に対する正規表現なら
// 返る位置は常に原文の座標になる。
function findLiteralMatches(
  source: string,
  query: string,
  options: SearchOptions,
): TextMatch[] {
  const flags = options.caseSensitive ? "gu" : "giu";
  const matches: TextMatch[] = [];
  let regex: RegExp;

  try {
    regex = new RegExp(escapeRegex(query), flags);
  } catch {
    return [];
  }

  const budget = createMatchAttemptBudget(source);

  // 件数と上限を「次の照合より前」に検査する。条件式の順序が exec 先だと、
  // 999 件そろっていても 1000 回目の照合（高コストになり得る）へ入ってしまう。
  while (matches.length < 999 && budget.take()) {
    const match = regex.exec(source);

    if (!match) {
      break;
    }

    const from = match.index;
    const to = from + match[0].length;

    if (!options.wholeWord || isWordBoundary(source, from, to)) {
      matches.push({ from, to });
    }
  }

  return matches;
}

function findRegexMatches(
  source: string,
  query: string,
  options: SearchOptions,
): TextMatch[] {
  const matches: TextMatch[] = [];

  try {
    const flags = options.caseSensitive ? "gu" : "giu";
    const regex = new RegExp(query, flags);
    const budget = createMatchAttemptBudget(source);

    while (matches.length < 999 && budget.take()) {
      const match = regex.exec(source);

      if (!match) {
        break;
      }

      const from = match.index;
      const to = from + match[0].length;

      if (match[0].length === 0) {
        // 空一致は採用しないが、前進はコードポイント単位で行う。UTF-16 の
        // サロゲートペアの途中へ +1 で進めると、次の exec が同じ位置の空一致へ
        // 戻り続けて無限ループになる（本文 "😀" に /^/gu など）。
        regex.lastIndex = advanceStringIndex(source, regex.lastIndex);
        continue;
      }

      if (!options.wholeWord || isWordBoundary(source, from, to)) {
        matches.push({ from, to });
      }
    }
  } catch {
    return [];
  }

  return matches;
}

// ECMAScript の AdvanceStringIndex 相当。u フラグ付き RegExp の前進規則に合わせて、
// サロゲートペアは 2 単位まとめて進める。
export function advanceStringIndex(text: string, index: number): number {
  if (index + 1 >= text.length) {
    return index + 1;
  }

  const first = text.charCodeAt(index);

  if (first < 0xd800 || first > 0xdbff) {
    return index + 1;
  }

  const second = text.charCodeAt(index + 1);

  if (second < 0xdc00 || second > 0xdfff) {
    return index + 1;
  }

  return index + 2;
}

// 外周（照合の呼び出し）回数の上限。正しい前進規則なら本文長の 2 倍 + 余裕で足りる。
//
// 注意: これは **1 回の照合にかかる時間**を制限しない。`exec()` 自体が
// バックトラックで長引くケース（例 `^(a+)+$`）は、この上限では止められない。
// UI の応答性まで保証するには照合を Worker へ分離する必要があり、それは別スライス。
function createMatchAttemptBudget(source: string) {
  let remaining = Math.max(2000, source.length * 2 + 1000);

  return {
    take(): boolean {
      remaining -= 1;
      return remaining > 0;
    },
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canCompileRegex(query: string): boolean {
  try {
    new RegExp(query, "u");
    return true;
  } catch {
    return false;
  }
}

function isWordBoundary(source: string, from: number, to: number): boolean {
  // 隣接文字はコードポイント単位で取る。UTF-16 の 1 単位で切ると、サロゲートペアの
  // 文字（補助面の漢字・数字）が片側だけになり、\p{L} / \p{N} に一致せず
  // 「文字・数字なのに単語境界」と誤判定する。
  const before = codePointBefore(source, from);
  const after = codePointAt(source, to);

  return !isWordCharacter(before) && !isWordCharacter(after);
}

function codePointAt(text: string, index: number): string {
  if (index < 0 || index >= text.length) {
    return "";
  }

  const code = text.codePointAt(index);

  return code === undefined ? "" : String.fromCodePoint(code);
}

function codePointBefore(text: string, index: number): string {
  if (index <= 0 || index > text.length) {
    return "";
  }

  const low = text.charCodeAt(index - 1);

  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = text.charCodeAt(index - 2);

    if (high >= 0xd800 && high <= 0xdbff) {
      return text.slice(index - 2, index);
    }
  }

  return text.slice(index - 1, index);
}

function isWordCharacter(char: string): boolean {
  return /^[\p{L}\p{N}_]$/u.test(char);
}
