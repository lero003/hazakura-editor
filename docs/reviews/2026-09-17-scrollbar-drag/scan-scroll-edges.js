// スクロール面の右端 / 下端が「隣接・外部の要素」に侵食されていないかを検査する。
//
// 見つけたい型: ペインのリサイザなどが透明な当たり判定を外へ張り出し、隣の
// スクロール面のスクロールバー帯を数 px 奪う（2026-09-17 の
// `.pane-resizer::before { left: -4px }` がこれ）。
//
// 使い方: アプリをブラウザで開き（例 `npm run dev:vite` の fixture）、DevTools コンソール、
// または Codex in-app browser の evaluate に、この IIFE 全体を貼って実行する。
//
// 返り値: { scanned: string[], conflicts: { scroller, problems }[] }
//   conflicts が空なら、どのスクロール面の端も他の要素に奪われていない。
//   1件でも出たら、その scroller の端で数 px の当たり判定が別要素（リサイザ等）に
//   食われている。2026-09-17 の `.pane-resizer::before` はこの検査で見つかった。
//
// 既知の限界:
//   - 判定は「自分自身か子孫なら安全」なので、スクロール面の *内側* にある
//     absolute / sticky の装飾レイヤーが端を覆うケースは理論上すり抜ける
//     （目的は隣接・外部要素による侵食の検出）。
//   - オーバーレイ型スクロールバーの「つまみだけを狙った」当たり判定はブラウザごとに
//     差があり、ヘッドレスでは再現しない。レイアウト型（macOS の「常に表示」）は
//     この検査で確定できる。
//   - 面ごとに DOM が違うので、書く / 読む / 確認 / ダイアログ / L Mode などを開いて
//     それぞれ実行する。1回の実行で見えるのは「いま画面に出ているスクロール面」だけ。
//     結果は「fixture で到達できる主要面」に限られ、アプリ全体の保証ではない。
(() => {
  const label = (el) =>
    el === null
      ? "null"
      : el.tagName.toLowerCase() +
        (typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "");
  // 見に行く端からの距離（px）。実スクロールバーは 10〜15px 程度。
  const band = 14;
  const scanned = [];
  const conflicts = [];

  for (const el of Array.from(document.querySelectorAll("*"))) {
    const cs = getComputedStyle(el);
    const canY =
      /(auto|scroll|overlay)/.test(cs.overflowY) &&
      el.scrollHeight > el.clientHeight + 1;
    const canX =
      /(auto|scroll|overlay)/.test(cs.overflowX) &&
      el.scrollWidth > el.clientWidth + 1;
    if (!canY && !canX) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;

    scanned.push(
      label(el) +
        "[" +
        Math.round(r.width) +
        "x" +
        Math.round(r.height) +
        (canY ? " y" : "") +
        (canX ? " x" : "") +
        "]",
    );

    const problems = new Set();
    // 右端（縦スクロールバー）: 上 / 中 / 下の3点から、端へ向けて 1〜band px。
    if (canY) {
      for (const frac of [0.12, 0.5, 0.88]) {
        const y = Math.round(r.top + r.height * frac);
        for (let d = 1; d <= band; d += 1) {
          const x = Math.round(r.right - d) - 0.5;
          if (x <= r.left) continue;
          const hit = document.elementFromPoint(x, y);
          // 自分の子孫なら正常（内容）。外の要素ならその端は奪われている。
          if (hit && !el.contains(hit)) {
            problems.add("right d" + d + " -> " + label(hit));
          }
        }
      }
    }
    // 下端（横スクロールバー）: 左 / 中 / 右の3点から、端へ向けて 1〜band px。
    if (canX) {
      for (const frac of [0.15, 0.5, 0.85]) {
        const x = Math.round(r.left + r.width * frac);
        for (let d = 1; d <= band; d += 1) {
          const y = Math.round(r.bottom - d) - 0.5;
          if (y <= r.top) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && !el.contains(hit)) {
            problems.add("bottom d" + d + " -> " + label(hit));
          }
        }
      }
    }
    if (problems.size) {
      conflicts.push({
        scroller: label(el),
        problems: Array.from(problems).slice(0, 8),
      });
    }
  }
  return { scanned, conflicts };
})();
