# 外部レビュー依頼 — UI-G2 / UI-G3（設定レール・紙面トークン）

Status: Review request
Scope: `fa6c9ba0..4bb09495`（codex/v3、4コミット）
Authority: Request
Date: 2026-09-10

## 何をレビューしてほしいか

`docs/external-agent-review-workflow.md` の Codex Review Contract の順で見てほしい。
実装とレビューを分けるのが目的なので、** blocking の指摘 → 残リスク** の順で。

| Commit | 変更 | 資料 |
| --- | --- | --- |
| `1cb1e564` | 設定カテゴリの現在地を本文スクロールから導出し左レールに示す | [G2](2026-09-10-v3-ui-g2/README.md) |
| `f772919c` | G2の証跡・引き継ぎ資料 | 同上 |
| `286581a9` | 紙面とナビ面を意味トークンとして新設し全7テーマへ適用 | [G3](2026-09-10-v3-theme-paper/README.md) |
| `4bb09495` | G3の証跡とモックとの差の棚卸し | [棚卸し](../v3-mock-gap-inventory.md) |
| （G4） | 開始画面（画面01）の2ペイン化・日時ラベル・履歴0件の案内 | [G4](2026-09-10-v3-ui-g4/README.md) |

対象面は設定ダイアログ、テーマ／面のトークン定義、開始画面の表示のみ。
保存・反映・パス・実行・AIの各契約には触れていない。

## 特に見てほしい5点（こちらが自覚しているリスク）

1. **edohigan / shinkai のエディタ面を不透明化**（`--cm-bg: var(--surface-paper)`）。
   これまで背景シェーダーを透かす半透明だった。C08「読む面は不透明に」を根拠にしたが、
   テーマの性格を変える判断なので妥当性を見てほしい。透過はサイドバーとガターに残している。
2. **chrome をナビ面に載せた**。モックのCSSは上部バー・タブ・ステータスに `--bg` を使い、
   `--side` はサイドバーだけに使っている。C04の役割表は `#EEF2EC` を「操作部／ナビ背景」としており、
   現行 v3-shell も chrome に同じ面を使っていたため `--nav-surface` に寄せた。どちらが正か判断が要る。
3. **面の差が控えめ**。紙面 `#fffefb` は白に近く、分離は色温度だけ。強めるかは未決（オーナー判断待ち）。
4. **G2の現在地ロジック**：`scroll` 直後の rect は未確定なことがあるため rAF の次フレームで測り、
   読み位置を80pxにして押下時の着地ズレ（実測最大71px）を吸収している。マウント時は先頭固定。
   閾値の妥当性と、`resize` でも同じ測定を走らせている点を見てほしい。
5. **テストの意図的な更新**：`themeContrast.test.ts` / `previewCss.test.ts` の読む面の assert を
   「preview.css の直値」から「テーマ側の `--surface-paper` を単一ソースとして参照」へ変更した。
   ガードを緩めていないか（むしろ強くなっているか）を確認してほしい。

## 主張と根拠

- コントラスト：7テーマ実測で 本文/紙面 10.08〜16.56、補助/紙面 4.82〜5.69、補助/ナビ 4.66〜6.24（C08の4.5:1目標）。
  測定方法は等倍描画の計算済みトークンから sRGB 相対輝度で計算。G2の現在地表示は実描画ピクセルから最頻色を採取。
- ローカル：`npm run typecheck` 成功、`npm test` **258ファイル / 2,242件**、`smoke:app-store-surface` 117件、`vite build` 成功、`cargo fmt --check` 成功。
- **言っていないこと**：native 200% / VoiceOver / 実機 / CI の合格。Rust は無変更で `cargo test` は未実行。
  `src-tauri/tauri.conf.appstore.json` の未コミット変更は別作業として保持（触っていない）。

## 再現手順

```bash
git checkout codex/v3 && git log --oneline -4
npm run typecheck && npm test
npm run dev:vite
# 実アプリ: http://127.0.0.1:1420/（localStorage の hazakura-note-theme / hazakura-note-menu-language で切替）
# 設定: http://127.0.0.1:1420/docs/reviews/2026-09-10-v3-ui-g2/fixture.html?theme=dark
```

## レビュー後の予定

- 段階2：文字色・アクセント・境界線の全テーマ調整（モックの `#24362d` / `#356b50` / `#dce2d9` 等）
- 01 開始画面の2ペイン構造、設定外枠寸法（1100px参考・レール200px）
