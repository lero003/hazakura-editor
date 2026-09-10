# スライスE-2 — 見開きの紙面・設定の境界説明とLIVE PREVIEW（画面04/16/17）

Status: Implemented
Scope: `src/styles/preview.css`（+`previewCss.test.ts`）・`src/components/editor/preview/EBookPane.tsx`・
`src/components/app/SettingsPreferencesPane.tsx`・`src/lib/locale/preferences.ts`・
`src/components/app/SettingsAssistAvailability.test.tsx`・`src/styles/dialogs.css`
Authority: Evidence（実アプリの実描画・DOM実測・CSS契約テスト）
Date: 2026-09-11
Branch: `codex/v3`

## 04 — 電子書籍・見開き

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 紙面と背景の階層・控えめな影 | `.ebook-page-sheet` に背景/罫線/影が無く、地の上に文字が浮いていた | **不透明な紙（`--surface-paper`）+ 1px罫線 + `--shadow-sm` + 角丸3px** |
| 見開き中央のごく小さな間隔 | `--ebook-page-gap: clamp(28px, 5vw, 44px)`（開きすぎ） | **6px**（モックは4〜6px） |
| 進捗バー | テキスト（ページ N/M）のみ | **`role="progressbar"` の細いバー**を読書ツールバーへ追加（未計測の間は 0%・valuemax=1 で「不明」を正直に出す） |

実アプリの実描画（1440×850・ライトテーマ）での実測:
`.ebook-page-sheet` = 389×395 / 背景 `rgb(255,254,251)` / 罫線 `rgb(199,210,197)` / 角丸3px、
`--ebook-page-gap: 6px`、進捗バー = `now=1 / max=4 / fill=25%`。

MEDIA:ebook-paper-1440.png

**未実装（記録）**: running header（実metadataがある場合のみ）、下部のページ操作帯（← 8–9/42 → この章を編集）、
単文書面と本全体面の統合。これらは読書面の構成変更で、別スライス相当。

## 17 — 設定・Local Assist

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 生成元と利用可否のカード | 可用性が平文2行だけ | **カード**（アイコン + 状態 + オンデバイスの説明）。状態は既存 `appleAssistStatus` をそのまま読む |
| 「しないこと」の境界を2×2 | 無し（別窓の説明に閉じていた） | **外部AIへ送信しない／反映するのは自分で／勝手に保存しない／対象は選んだ文章** の4枚 |
| 生成内容の注意 | 無し | 1行の注意を追加 |

- 同じ状態文言が二重に出ないよう、**旧・平文の状態行を削除**してカードへ一本化（a11y の `role="status"` + `aria-label` は維持）。
- 新しい状態機械は作らず、`probe` の結果をそのまま表示するだけ。**設定を開いただけで生成しない**ことは従来どおり。
- 実測: カード 834×105、`title=Hazakura Local Assist の状態`、境界4枚のタイトルがすべて表示。

MEDIA:settings-assist-1440.png

## 16 — 設定・文字と表示（LIVE PREVIEW）

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 選択した設定をその場で確かめる面 | 各サイズ行のインライン見本のみ | **プレビュー面**（キャプション + 本文プレビュー + 現在のプレビュー文字サイズ） |
| 保存値を勝手に変えない | 済み | 従来どおり**保存済みの値だけ**を使い、ここから本文も設定も書き換えない |

- 行間は独立した設定が無いため（D06）、プレビュー既定の 1.9 を使う（**未決**として記録）。
- 実測: 834×112、キャプション「この設定での見え方」、本文は `15px`（既定値）。

MEDIA:settings-type-preview-1440.png

## 検証

| 種別 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **270ファイル / 2,370件** 成功（+2件） |

途中で1件落ちたのは、設定本文に見出しタグ（`h3`/`h4`）を足したことで**カテゴリ位置の計算対象がずれた**ため。
見出しタグは設定のカテゴリ見出しだけに残し、カード内は通常要素＋クラスへ変更して解消（意味的にも正しい）。

## 残り

- **05 本の構成の専用面**・**12 Import の専用2ペイン**・**13 復元の3領域**・**18 使い方の4カード面**。
- 04 の running header / 下部ページ操作 / 面の統合。
