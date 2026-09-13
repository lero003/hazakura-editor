# v3・空気感の調整と実機確認

Status: Implemented and locally verified within the scope below
Scope: 24モックのレビューから、情報密度・余白・文字の強弱を小さく調整
Authority: Implementation evidence; not release acceptance
Date: 2026-09-13

オーナーの「情報を増やさず整理し、実機を見ながら適度に調整する」という指示で実施。
[実機の前後比較](report.html) / [元の24画面レビュー](../2026-09-13-v3-atmosphere-audit/README.md)。

## 変更

- **設定・ヘルプ:** 全幅の切替帯をなくし、ヘッダーの既存セレクタへ集約。既存のコマンドメニューと同じ言語・名称を使う。ヘルプ本文を先に表示し、制作・公開向けの注記は本文末尾の「この文書について」で展開する。開示本文とリンク処理は維持。英語の文書全体の翻訳や新しい使い方案内は追加していない。
- **復旧・保存衝突:** 対象のダイアログだけを不透明な `--surface-paper` に揃えた。警告、比較、別名保存、元に戻る操作の区別を保つ。
- **検索:** 行の縦余白を5pxから9pxへ。結果本文は通常のUI書体、行番号は等幅。ファイル名の大文字変換を外し、グループ間に余白を置いた。選択は淡い共通色と左端の線で示す。
- **読書:** 先頭見出しを本文の左端へ揃え、飾り線を外す。h1は本文の1.55倍、h2は1.4倍・weight 600へ抑え、下余白を1.2emにした。章間プレビューにも同じ組版を使う。
- **狭幅:** 文書領域960px以下で既存の編集／プレビュー一面切替を使う。設定を追加せず、広げると保存済みの分割へ戻る。窓全体1024pxを一律に一面へ変える規則ではない。
- **実機で見つけた不具合:** 一章文書では目次が省かれる一方、本文が目次用の細いグリッド列に入っていた。目次なしの本文を全列へ広げるCSSを追加。`before-reader-single-chapter-bug.png` と `after-reader-single-chapter.png` で確認できる。

Markdown、保存形式、ページ位置の管理、提案のApply／Undo、永続設定の仕様は変更していない。
組版変更によってページ数は変わり得る。既存の未コミット変更を保ち、コミット・公開はしていない。

## 実機の確認範囲

`Hazakura Atmosphere QA.app` を現行の未コミットソースから再ビルドし、MacのネイティブWebViewと実際のファイル操作で確認した。
通常のアプリと識別子を分けたQA用App Storeレーン・ad-hoc署名であり、提出候補ではない。
設定と文書はQA用に分離。検証で有効にしたバックアップは終了時にオフへ戻し、未保存の検証編集はUndoした。

| 確認 | 結果・証拠 |
| --- | --- |
| 設定、日本語の項目切替、閉じる | `after-settings.png`。二段の案内を一段に整理 |
| ヘルプ本文、末尾までスクロール、注記の開閉 | `after-help.png`, `after-help-notes.png`。閉じる操作は常時表示 |
| 検索、選択行、キーでの結果移動 | `after-search.png`。実フォルダを検索し、別文書への移動を確認 |
| 複数章の読書、章移動、ページ送り | `after-reader.png`, `after-reader-chapter.png`, `after-reader-page2.png` |
| 一章文書の読書 | `after-reader-single-chapter.png`。本文幅とページ1/1、下部操作を確認 |
| 最小付近の窓・編集／プレビューの切替 | `after-compact-editor.png`, `after-compact-preview.png`。幅960pxの撮影 |
| 窓を広げた後の分割 | `after-wide-restored.png`。サイドバー280、分割42の元の値をAXで確認 |
| 実際のバックアップ一覧→比較 | `after-recovery.png`。QA文書で作成された `.bak` を選択。反映はしていない |
| 未保存編集と外部変更の衝突→比較 | `after-conflict.png`, `after-conflict-compact.png`, `after-conflict-compare.png`。ディスクを上書きせず比較 |
| テーマ隣接確認 | `after-settings-dark.png`, `after-search-dark.png`, `after-reader-edohigan.png` |

掲載画像はこのラウンドで撮影したnative画面。撮影APIによる画像サイズ調整があるため、
画像の幅とCSSの窓幅を同一視したピクセル判定はしない。比較用文書は検証操作で一部変わり、
衝突の前後では文書・文字数も異なる。面色・余白・文字階層の比較に用いる。

## 自動確認

- ナビゲーションの日本語・同一ヘッダー、ヘルプ注記の保持と順序を失敗テストで再現して修正。
- 目次なしの幅はnativeで再現後、CSSの回帰テストをred→greenで追加。
- `npm run typecheck` 成功。
- 全Vitest **282ファイル・2,492件** 成功（最終ソース）。
- `npm run smoke:app-store-surface` **125件** 成功。
- `npm run build:vite` 成功。既存の500KB超チャンク警告あり。
- QAアプリのビルドと `codesign --verify --deep --strict` 成功。
- `git diff --check` 成功。

関係ソースと最終QAバイナリのSHA-256は [source-evidence.json](source-evidence.json)。
Habitatはnpm・既存依存を使う方針を確認し、今回はTS/CSSとnative表示に該当する検証を選んだ。
Rust・helper・署名設定の製品コードは変更していない。

## 残る確認

これはUI調整の実機確認であり、v3全体のリリース受入ではない。
VoiceOver、文字200%、日本語IMEの通し操作、全7テーマ、広い見開きのnative確認、
Local Assistの実生成／停止／反映、Import Assist、書き出し現物、提出候補の再作成・受入は別に残る。
ヘルプ本文の日本語化とモック18の使い方ページ新設も、この整理には含めていない。
