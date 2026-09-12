/**
 * パンくず（画面02）。モックは「散文集 / chapters / 02_朝の余白.md」のように、
 * いま開いている文書がどこにあるかを示す。ここはパスの末尾だけを出す
 * （長い絶対パスをそのまま出さない＝情報を増やさない）。
 *
 * @param path 文書の絶対パス（未保存は null / "" を渡す）
 * @param maxParts 出す末尾要素の数
 * @returns 末尾からの要素（例: ["chapters", "02_朝の余白.md"]）。無ければ []
 */
export function documentBreadcrumbParts(
  path: string | null | undefined,
  maxParts = 2,
): string[] {
  if (!path) {
    return [];
  }
  const parts = path.split(/[\\/]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  return parts.slice(-Math.max(1, maxParts));
}
