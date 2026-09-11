# ステータスバーの文字コードチップ（実機指摘⑤⑥）

Status: Implemented
Scope: `src/components/app/StatusBar.tsx`（+`.test.tsx`）・`AppStatusBar.tsx`・
`src/hooks/app/useAppShellController.ts`（表示文字列の配線）・`src/lib/locale/editorChrome.ts`・
`src/styles/preview.css`・`src/styles/tokens.css`・`themes.css`・`crt-theme.css`・`shinkai-theme.css`・
`src/styles/statusCss.test.ts`
Authority: Evidence（実コンポーネントの実描画・PNG画素測定）
Date: 2026-09-11
Branch: `codex/v3`

実機フィードバック（`3.0気になるところ.md`）の⑤⑥への対応。オーナー判断は
「開き直すチップは統合してよい／読み直すが安全側」、および「パッと見で違いが分からない」。

## ⑤ ライトテーマで「改行LF」「文字コード」「開き直す」の文字が見えない

**原因（実測）**: ステータスバーは v3 で `--chrome-surface`（ライト `#f7f8f5`）の面になったが、
チップの文字は旧・暗色ステータスバー専用の `--status-text`（ライト `#f0f7f3`＝ほぼ白）を
参照したままだった。`themeContrast.test.ts` の面検査は `--text` / `--text-muted` を
`--chrome-surface` に対して見ており、この2トークンは全7テーマで 4.5:1 以上
（light 12.0 / 5.0）を満たしている。**チップの文字をその2トークンへ寄せた。**

- `.status-bar-format-chip` / `.status-bar-format-value` / `.status-bar-format-select` → `var(--text)`
- `.status-bar-format-label` → `var(--text)`（下の「実測」参照。`--text-muted` では
  チップの塗りの上で 4.35:1 まで落ちたため、階層は太さ（値700 / ラベル600）で付ける）
- 詳細テキスト（`1,268 文字` 等）の `opacity: 0.85` を撤去。同じ面で **3.67:1** まで
  落ちていた（報告と同じ class の不具合。`--text-muted` 単体で 4.98:1）
- ネイティブのポップアップ面は `color-scheme` で決まる。ライトテーマで暗いメニューが
  出ないよう、`--form-control-scheme`（light 既定。dark/yakou/crt/shinkai は dark）を新設

## ⑥「開き直す」は要る？ → 文字コードの**1チップ2群**へ

文字コードの操作は**1つに見えて2つ**ある（どちらも `tab.encoding` を変える）。

| 操作 | 何をするか | 危険 |
| --- | --- | --- |
| 読み直す（旧: 開き直す） | ファイルをその文字コードで**読み直す** | 画面は化けるが**ディスクは無傷**。別のコードで開き直せる。未保存があるときは実行しない（既存ガード） |
| 保存時に変える（旧: 文字コード選択） | 次に保存するときの**書き込み**コードを変える | **そのコードで表せない文字は保存時に落ちる**。保存後は戻せない |

「UTF-8の原稿をShift-JISとして保存する」変換は後者にしか経路が無いため、**消さずに残した**。
別チップ2つでは違いが読めないので、**1つの select の中を2群**にし、安全な「読み直す」を先に置く。

- `optgroup`「この文字コードで読み直す」（読み直す・**先頭**）／「保存する文字コードを変える」
- 読み直す群は `activeTab.path` が無ければ出さず、未保存の編集があるときは `disabled`
  （理由はチップの `title` に出す。実行側 `reopenTabFromDisk` と同じ条件を表示側でも先に出す）
- 選択値の接頭辞（`reopen:` / `save:`）で操作を分ける（同じ文字コードでも操作が違うため）

## 検証（実行した数字だけ）

- `npm run typecheck` 成功／`npm test` **277ファイル・2,410件**成功（変更前 275・2,403）
- `npm run smoke:app-store-surface` 10ファイル・**115件**成功
- `npm run build:vite` 成功
- Rust 無変更（`cargo test` 未実行）

### 表示（PNG画素測定・deviceScaleFactor 1・1440×850）

同座標のチップ（`改行 LF` / `文字コード UTF-8`）を最頻色（面）と最暗色（文字の芯）で測った。

| 対象 | 修正前 | 修正後 |
| --- | ---: | ---: |
| 値 `LF` | 1.03:1 | **10.48:1** |
| ラベル `改行` | 1.02:1 | **10.48:1** |
| 詳細 `1,268 文字` | 3.67:1 | **4.98:1** |

修正前は「同じライト面に白」＝1.02〜1.03:1 で、報告どおり文字が読めない状態だった。
修正前の像は、現行 CSS に旧トークンを当てた同じ枠で撮っている（`-before` は比較用で、
製品の状態ではない）。

- `status-light-before.png` / `status-light-after.png`（比較・1440×850）
- `chips-light-before-zoom.png` / `chips-light-after-zoom.png`（チップ部6倍）
- `statusbar-light-after-zoom.png`（詳細＋チップ 5倍）
- `status-dark-1440.png` / `status-light-dirty-1440.png`
  （ダークで沈まないこと、未保存時に読み直す群が `disabled` になること）

## 画像との差・未決

- モックのステータスバー（画面02）は「文字数 / Markdown / UTF-8 / LF」の値だけで、
  **ラベル文字と「開き直す」は無い**。値の表示自体は既存どおりで、行き先は変えていない。
- `optgroup` の見出しはネイティブメニューの描画に従う（この2群の並びは実機で要目視）。

## 残リスク・未受入

- **実機での再読込**（`open_text_file(path, encoding)` を伴う経路）と、文字化けファイルでの
  往復は未実施。テストは選択値の分岐（`reopen:` / `save:`）までを固定している。
- 200%文字、VoiceOver、別窓同期、再起動後の設定保持。
- 他のテーマ（edohigan / shokou / yakou 等）でのネイティブポップアップの見え方
  （PNG画素で測れるのは chrome 面のみ）。
