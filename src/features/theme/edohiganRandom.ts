/**
 * 決定論的な擬似乱数（mulberry32）。
 *
 * 依存を増やさず、同じ種から常に同じ木・同じ花弁の配置を得るために使う。
 * 見た目の「毎回変わる」を避け、テストで配置を固定できるようにする。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
