# 外部レビュー依頼 — UI-G2〜G4（設定レール・紙面トークン・開始画面）

Status: Review request（2回目）
Implementation scope: `fa6c9ba0..2a118313`（8コミット）
Review packet HEAD: `14609e2f`（docs-only、ブランチ全体では9コミット）
Authority: Request
Date: 2026-09-10

## 何をレビューしてほしいか

`docs/external-agent-review-workflow.md` の Codex Review Contract の順で見てほしい。
1回目のレビューで受け取った **P2×2** と非ブロッキング指摘への対応を、実装（`2a118313`）と資料の両方で反映した。
**blocking の指摘 → 残リスク** の順で。

| Commit | 変更 | 資料 |
| --- | --- | --- |
| `c937e036` | 設定のLocal Assist状態に「未確認」表示をテストで固定（挙動変更なし・assert 1行） | [G2](2026-09-10-v3-ui-g2/README.md) |
| `1cb1e564` | 設定カテゴリの現在地を本文スクロールから導出し左レールに示す | 同上 |
| `f772919c` | G2の証跡・引き継ぎ資料 | 同上 |
| `286581a9` | 紙面とナビ面を意味トークンとして新設し全7テーマへ適用 | [G3](2026-09-10-v3-theme-paper/README.md) |
| `4bb09495` | G3の証跡とモックとの差の棚卸し | [棚卸し](../v3-mock-gap-inventory.md) |
| `43ef5276` | 開始画面（画面01）を左ブランド・右続きの2ペインへ再配置 | [G4](2026-09-10-v3-ui-g4/README.md) |
| `b5d85668` | G4の証跡とレビュー依頼資料 | 同上 |
| `2a118313` | 1回目のレビュー対応：末尾clamp・テーマ整合テストの実CSS参照化 | G2/G3の各資料 |

前回の依頼文で「4コミット」と書いていたのは誤り（`c937e036` が抜けていた）。現在は8コミットで、
対象面は設定ダイアログ、テーマ／面のトークン定義、開始画面の表示のみ。
保存・反映・パス・実行・AIの各契約には触れていない。

## 1回目のレビュー指摘への対応

| 指摘 | 対応 |
| --- | --- |
| **[P2] G2: 最下部で最終カテゴリを current にできない** | `resolveSettingsCategoryIndex` に `viewport` を追加し、`scrollTop + clientHeight >= scrollHeight - 1` のとき最後の測定可能な見出しを返す。純関数テスト2件＋`scrollTop` を clamp する stub でのコンポーネントテスト1件（最下部にしか到達できない本文を再現）を追加。80px閾値は変更なし |
| **[P2] G3: コントラストテストが実CSSを読まず、nav面が未検査** | コントラスト計算に使う**文字色・補助文字・ナビ面の色**をCSSから実取得する形に変更（のち `--chrome-surface` も同様に自動検査）。**紙面の設計値（7色）と selection palette は意図的にテスト内でpin**し、別テーマへ静かに流用されないようにしている。不透明ナビ5テーマの自動検査を追加。半透明の edohigan / shinkai は「`rgba()` 宣言であること」だけを固定し、コントラストは**実描画ピクセル測定**（`rgb(47,30,45)` / `rgb(11,40,54)` に対し 12.67・6.00 / 12.46・5.96）へ分離し、資料の断定も「合成条件付き」に弱めた |
| 半透明navの「全テーマ・全面4.5:1」断定が強すぎる | 上記のとおり確認範囲を分離。紙面と不透明ナビは自動検査、半透明は合成条件付き測定、ネイティブ実機は未受入と明記 |
| shokou の補助/紙面が古い | `5.23` へ更新（`#526b7f` / `#f5f8fc`） |
| `chrome` をナビ面に固定するのは早い | **未決として記録**。現状は「ツールバー・ステータス・サイドバー＝nav、`.tabs-row`＝paper」で一貫していない。推奨案（Editor=paper / Sidebar=nav / Toolbar・tabs・status=bg、将来 `--chrome-surface`）を G3資料に残し、段階2で決める |
| [P3] `ResizeObserver` の方が堅い | 今回は `window.resize`。本文内 reflow は次の scroll で追従する旨を G2資料の残リスクに記載 |

## 特に見てほしい点

1. **末尾clampの判定**：`scrollHeight - clientHeight` の 1px 遊びで最下部とみなす実装と、
   そのとき「最後に測定できた見出し」を返す仕様。短い最終セクション・見出し未測定（NaN）の扱いを含む。
2. **テストの実CSS参照化**：`themeContrast.test.ts` が色をハードコードしなくなったこと。
   不透明navの自動検査と半透明navの分離が、ガードとして妥当か（緩めていないか）。
3. **G4 の開始画面**：既存データ／コールバックの再利用、`aria-label`（表示名）と行の表示内容、
   履歴0件の案内、`toContain` へ変更した textContent assert の妥当性。
4. **`--surface-paper` / `--nav-surface` の適用範囲**：edohigan / shinkai のエディタ面を不透明化した点、
   `.tabs-row` が紙面・ツールバーがナビ面という現状の一貫性。
5. **docs の主張が実装を超えていないか**：特に「4.5:1」の範囲表現と、native受入の未実施の書き方。

## 主張と根拠

- ローカル：`npm run typecheck` 成功、`npm test` **259ファイル / 2,250件**、`smoke:app-store-surface` 117件、
  `vite build` 成功、`cargo fmt --check` 成功。Rust は無変更で `cargo test` は未実行。
- **言っていないこと**：native 200% / VoiceOver / 実機 / CI の合格。半透明ナビの合成は紙面上での測定であること。
- `src-tauri/tauri.conf.appstore.json` の未コミット変更は別作業として保持（触っていない）。

## 再現手順

```bash
git checkout codex/v3 && git log --oneline -9
npm run typecheck && npm test
npm run dev:vite
# 実アプリ: http://127.0.0.1:1420/（localStorage の hazakura-note-theme / -menu-language / -recent-folders で状態を作れる）
# 設定: http://127.0.0.1:1420/docs/reviews/2026-09-10-v3-ui-g2/fixture.html?theme=dark
```

## レビュー後の予定

- 段階2：文字色・アクセント・境界線の全テーマ調整＋chrome/tabs/status の面の決定
- 設定の外枠寸法（1100px参考・レール200px）、画面16/05/23/24
- native 受入（VoiceOver / 200% / 再起動後設定 / 実System）
