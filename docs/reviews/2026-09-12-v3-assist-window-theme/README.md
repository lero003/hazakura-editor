# Local Assist 分離窓の江戸彼岸テーマ修正

Status: Review record
Scope: 分離窓（Hazakura Local Assist）のフラット面のテーマ色
Date: 2026-09-12
Reviewed source: `374f475c`（実装。本資料は後続の資料コミット）

## 結論

オーナー報告「特定のテーマで Local Assist を見ると色味がすごく変」を再現した。分離窓には
**江戸彼岸が暗色だった時代の固定背景色 `#322438` が残っており**、2026-09-11 に明色へ作り替えられた
テーマのインク（`#453735`）がその暗色面に載っていた。結果、分離窓の本文が **1.28:1** まで沈み、
「暗い窓地 ＋ 一部だけ明色（入力欄）」という完全な不整合になっていた（[修正前](edohigan-before.png)）。

基の `background: var(--bg)`（`#fbf4f2` のフラット面）へ戻して修正（[修正後](edohigan-after.png)、
実測 **10.44:1**）。**他の6テーマは 10.5〜15.1:1 で正常**で、修正前後で不変。

温存されていた理由も特定した。`appleAssistWindowCss.test.ts` が `#322438` を**現状のpinとして
固定**していたため、江戸彼岸の明色化（2026-09-11）でもこの1行が追随しなかった。
再発防止として、**面ごとのコントラスト契約に分離窓の面を追加**した（全7テーマ・4.5:1以上。
修正前の値では実際に落ちることを先行確認）。

## 再現と実測（実 component ＋ 実 CSS のブラウザ fixture）

fixture: このディレクトリの `fixture.html` / `fixture.tsx`（`?theme=<name>` で7テーマを実描画。
`npm run dev:vite` → `http://127.0.0.1:1420/docs/reviews/2026-09-12-v3-assist-window-theme/fixture.html?theme=edohigan`）。
計測は分離窓 `.apple-assist-window-shell` の背景色と本文色のコントラスト比。

| テーマ | 窓地（実測） | 文字（実測） | コントラスト | 備考 |
|---|---|---|---|---|
| edohigan（修正前） | rgb(50, 36, 56) | rgb(69, 55, 53) | **1.28** | 本文・見出し・状態文が読めない |
| edohigan（修正後） | rgb(251, 244, 242) | rgb(69, 55, 53) | **10.44** | 明色のフラット面 |
| light | rgb(247, 248, 245) | rgb(36, 54, 45) | 12.01 | 不変 |
| dark | rgb(24, 36, 30) | rgb(229, 237, 223) | 13.37 | 不変 |
| yakou | rgb(20, 20, 30) | rgb(232, 232, 244) | 15.05 | 不変（フラット固定） |
| shokou | rgb(238, 245, 251) | rgb(28, 53, 84) | 11.32 | 不変（フラット固定） |
| crt | rgb(8, 18, 12) | rgb(155, 224, 164) | 12.33 | 不変（フラット固定） |
| shinkai | rgb(15, 53, 72) | rgb(212, 236, 242) | 10.52 | 不変（フラット固定） |

生データ: `theme-measurements-before.json` / `theme-measurements-after.json`。
スクリーンショット: [edohigan-before](edohigan-before.png) / [edohigan-after](edohigan-after.png) /
[light（比較）](light-normal.png) / [shinkai（比較）](shinkai-normal.png)。
目視でも、修正前は「暗色の窓に明色の入力欄だけ」、修正後はテーマどおりの明るい桜色の面として
一貫していることを確認した。

## 変更（`374f475c`）

| ファイル | 変更 |
|---|---|
| `src/styles/apple-assist-window.css` | edohigan の固定背景 `#322438` の上書きを削除し、基の `var(--bg)` へ戻す。経緯をコメントに記録 |
| `src/styles/themeContrast.test.ts` | 「assist window shell surface」を追加: 全7テーマで窓地と `--text` の 4.5:1 を検査（上書きが無いテーマは `--bg` を解決） |
| `src/styles/appleAssistWindowCss.test.ts` | edohigan の固定リテラルpin を外し、「明色化後に暗色リテラルを持たない」契約へ変更。他4テーマのフラット固定は現行のまま |

生成・提案・反映・選択の契約、他テーマの見え方、ネイティブ外観（Rust の `set_apple_assist_window_theme`
は edohigan→Light で既に正しい）は変更していない。

## 検証

| 検証 | 結果 |
|---|---|
| 失敗テスト先行（修正前） | 2件失敗: コントラスト 1.28 < 4.5、`#322438` リテラル検出 |
| `npx vitest run src/styles/themeContrast.test.ts src/styles/appleAssistWindowCss.test.ts` | **107件成功**（修正後） |
| `npm test` | **283ファイル / 2,487件成功**（新規8件） |
| `npm run typecheck` / `npm run build:vite` | 成功（既存のチャンク警告のみ） |
| `npm run smoke:app-store-surface` | 10ファイル / 125件成功 |
| ブラウザ実測 | edohigan 1.28 → 10.44、他6テーマ不変 |
| `git diff --check` | 成功 |

未実施: native（WKWebView）での目視、VoiceOver、macOS Increase Contrast との併用、実機のテーマ切替。
この面はフラット指定のため WebGL シェーダー合成の対象外（分離窓は演出を継承しない方針）。

## 実機で次に確認すること

- 配布候補（または `npm run dev`）で江戸彼岸のまま Local Assist 窓を開き、面と文字の整合を目視。
- 既存のテーマ切替条件（明↔暗をまたぐ1回・信号機位置。`windowAppearance.ts` の既知事項）はそのまま。

## 参照

- 修正対象は分離窓のフラット面のみ。関連する正本: `docs/assist-surface-strategy.md`（表現面）、
  `src/styles/themeContrast.test.ts`（面のコントラスト契約）、`src/styles/appleAssistWindowCss.test.ts`。
