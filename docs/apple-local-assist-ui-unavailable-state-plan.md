# Apple Local Assist — UI Unavailable State 方針メモ

Status: Planning (post-slice-7)
Scope: v0.12+ で 4 状態 (`available` / `unavailable` / `disabled` / `unsupported`) をユーザーにどう見せるかの方針整理
Authority: Medium
Last reviewed: 2026-06-05

## 目的

v0.12 の現状 (slice 6 時点) は `useCommandPaletteController` で「`availability.kind === "available"` のときだけ command palette entries を表示する」最小実装。ユーザーが「Apple Assist がない」理由をたどれない。

本スライスでは 4 状態を **ユーザーにどう提示するか** の設計を比較し、v0.12 では UI を増やさない方針を維持する。実装はしない。必要なら「次バージョン候補」として docs に残す。

## 現状 (slice 6 時点)

`src/hooks/commandPalette/useCommandPaletteController.ts`:

```ts
...(appleAssistAvailability.kind === "available"
  ? [
      { id: "appleAssist.summarize", label: ..., run: ... },
      { id: "appleAssist.rephrase",  label: ..., run: ... },
    ]
  : []),
```

- `available` 以外のとき: command palette 項目は **完全に非表示**
- `useAppleAssistAvailability` 自体は結果を `availability` として state に持つが、その値を表示する UI はない
- Review Desk 側で generate 失敗時の error 文言を出す経路はある (`useAppleAssistCandidate` の `setStatus` 経由)
- 失敗 (probe error / generate error) 時にユーザーへ伝える手段は status bar のテキストのみ
- 4 状態と 5 operation の locale 文言は `src/lib/locale/appleAssist.ts` に集約済み

## 設計の比較

### 案 A: 現状維持 (hidden)

- **動作**: `available` 以外のとき command palette 項目を一切出さない
- **Pros**:
  - 実装コスト 0 (現状)
  - ノイズがない。`available` のときだけ項目が出るので UX がクリーン
  - v0.12 の "gate-default-hidden" 契約と整合
- **Cons**:
  - 「なぜ Apple Assist が出ないのか」が分からない。`disabled` の人が System Settings で有効化できない、`unsupported` の人はハードウェアを買い替えるしかないので、提示する情報がないとも言える
  - Apple Assist の存在をそもそも知らないユーザーには伝わらない

### 案 B: 無効状態で表示 (disabled palette item)

- **動作**: 4 状態それぞれで command palette に disabled な項目を出す
  - 例: `Apple Assist: Apple Intelligence がオフです (設定で有効化してください)` をグレーアウト表示
  - 選択しても何も起こらない (もしくは "なぜ使えないか" ヘルプを開く)
- **Pros**:
  - 機能存在の discoverability が高い
  - 理由がユーザーへの説明になる
  - 設定変更で復帰する余地を伝えられる (`disabled` / `unavailable`)
- **Cons**:
  - コマンドパレットが常に 2 行 Apple Assist で埋まる (Apple Intelligence がオンの人でも)
  - 動的に件数が増えるのは設計の単純さを損なう
  - "disabled" と "unsupported" の違いを短いラベルで示すのが難しい
  - 4 状態それぞれで文言をメンテする必要がある (locale 込みで 3 言語 × 4 状態 × 2 operation = 24 種類)

### 案 C: ステータスバー項目 (persistent indicator)

- **動作**: ステータスバーに小さい "🪄" アイコン (もしくは "AI" バッジ) を置き、hover / クリックで 4 状態を表示
  - `available`: 緑、選択で command palette を Apple Assist カテゴリにフォーカス
  - `disabled`: 黄色、hover で "Apple Intelligence を有効化してください"
  - `unavailable`: オレンジ、hover で reason
  - `unsupported`: グレー、hover で "This Mac does not support Apple Intelligence"
- **Pros**:
  - 永続的な可視性。ユーザーは状態を意識できる
  - command palette を汚さない
  - クリックで次のアクションに動ける (System Settings を開く、ヘルプを開く等)
- **Cons**:
  - 新しい chrome 要素。Safe Editor の "minimal chrome" 哲学と緊張する
  - ステータスバーは現在 L Mode の状態表示で精一杯
  - 実装コスト中 (状態管理 + chrome 追加 + locale + a11y)

### 案 D: Preferences に "Apple Local Assist" セクション

- **動作**: Preferences dialog に専用セクションを追加
  - 4 状態の表示 (色付きバッジ)
  - "Apple Intelligence を有効化" ボタン (`disabled` のとき) → `x-apple.systempreferences: AppleIntelligence` を開く
  - "詳細" リンク → リリースノート / ドキュメントへ
  - **enable / disable トグルは v0.12 で出さない** (gate-default-hidden 契約と相性が悪い)
- **Pros**:
  - 設定の集約場所として自然
  - 4 状態をまとめて提示できる
  - ユーザーへの説明スペースが広い
- **Cons**:
  - 設定画面を開く動線がユーザーに必要 (現状 Preferences にはあまり行かない)
  - 新セクション = 新しい UI 表面
  - 4 状態のバッジ実装が locale 込みで複雑

### 案 E: トースト / 最初の 1 回ヒント

- **動作**: command palette を開いて "Apple Assist" で検索したのに何も出ないとき、1 回だけトーストで "Apple Local Assist は Apple Intelligence がオフのとき使えません" のようなヒント
- **Pros**:
  - 1 度きりの説明で discoverability を確保
  - 永続的な chrome 増やさず
- **Cons**:
  - "1 回だけ" の実装が複雑 (再表示の条件)
  - ユーザーがヒントを見落とす

### 案 F: 複合 (案 B + 案 D)

- 案 B (disabled palette item) と案 D (Preferences セクション) を組み合わせる
- 案 B は常時 discoverability、案 D は詳細説明
- **Pros**: 最大限の discoverability + 説明
- **Cons**: 実装コスト大、保守対象が増える、v0.12 の "minimal" 哲学から大きく外れる

## 比較表

| 案 | discoverability | ノイズ | 実装コスト | 哲学との整合 |
|---|---|---|---|---|
| A: 現状維持 | 低 | 0 | 0 | 完璧 |
| B: disabled palette item | 高 | 中 (常時 2 行) | 中 | 中 (command palette の意味を変える) |
| C: ステータスバー | 高 | 中 (常時 1 要素) | 中〜大 | 中〜低 (chrome 追加) |
| D: Preferences セクション | 中 (開かないと気付かない) | 0 (dialog 内) | 中 | 中 (新セクション) |
| E: 1 回トースト | 中 (見落としうる) | 0 (1 度だけ) | 中 | 中 (1 回だけという状態管理) |
| F: 複合 | 高 | 大 | 大 | 低 |

## 推奨

**v0.12.0 release: 案 A (現状維持)** + **App Store build 用の in-app disclosure 文言 (別件)**。

理由:

- v0.12 は "余計な UI を増やさない" 方針 (design review section 7)
- live mode が着地しない限り `Available` を返さないので、4 状態を区別して提示する動線がそもそも薄い
- 失敗 (probe error / generate error) 時の文言は status bar で出ており、ユーザーが「なぜ」を気にする場面は限定的
- ユーザーが `disabled` (Apple Intelligence オフ) の場合、System Settings の Apple Intelligence 設定を見れば分かる。これは Apple 自身の UI 説明で十分

**v0.12.1+ (live mode 着地後): 案 D (Preferences セクション) を評価**。

理由:

- live mode が入ると、ユーザーが Apple Intelligence の有効化 / モデルダウンロード / 言語設定を切り替える動線が必要になる
- Preferences はその動線として自然
- live mode 自体に説明責任 (acceptable use への同意) が発生するので、Preferences は「enable」スイッチ + 「なぜ無効か」詳細 + ドキュメントリンクの 3 点置き場になる
- 実装は v0.12.1+ の別スライスで。v0.12.0 では設計判断のみ残す

**v0.13+ (Assist Preview)**: 案 F (複合) も検討。`extract` / `proofread` / `explain_diff` を追加するときに、ユーザーに "新しい 3 operation が加わった" ことを伝えたいタイミングが来る。command palette での提示 + Preferences での説明の両方が必要になりうる。

## 副次的な論点: in-app disclosure (App Store build)

`docs/apple-local-assist-distribution-plan.md` の "Official Information Confirmed" セクションで触れたとおり、App Store build には **Apple Intelligence を使う旨と acceptable use への同意を App Store build に組み込む文言** が必要 (item 1 / item 14 対策)。

これは 4 状態の UI とは別の論点。Preferences の "Apple Local Assist" セクションに短い disclosure を置くのが自然。

文案 (3 言語 / 暫定):

| 言語 | 文案 |
|---|---|
| en | "Apple Local Assist uses Apple Intelligence and the Foundation Models framework on this Mac. Output is subject to Apple's acceptable use requirements. You are responsible for not using generated text in ways that violate them." |
| ja | "Apple Local Assist はこの Mac の Apple Intelligence / Foundation Models framework を利用します。生成結果は Apple の acceptable use 要件の対象となります。要件に違反する用途で使わない責任はユーザーにあります。" |
| kana | "Apple Local Assist は この Mac の Apple Intelligence / Foundation Models framework を りよう します。せいせい けっか は Apple の acceptable use ようけん の たいしょう と なります。ようけん に いはん する ようと で つかわない せきにん は ユーザー に あります。" |

**v0.12.0 リリース時点でこの disclosure を入れる必要はない** (live mode が着地していないので App Store build にも Apple Assist は含まれないため)。ただし live mode 着地 + App Store submission 時には必須なので、Preferences セクション実装 (案 D 採用時) と一緒に作る。

## 実装 plan

| 順番 | 内容 | 影響範囲 |
|---|---|---|
| 1 | (v0.12.0) 何もしない。command palette 現状維持 | - |
| 2 | (v0.12.1+ live mode 着地時) 案 D を採用するなら Preferences に "Apple Local Assist" セクション追加。availability の 4 状態を色付きバッジで表示。"Apple Intelligence を有効化" リンク、`HAZAKURA_APPLE_ASSIST_DISCLOSURE` 3 言語文言 | TS + locale |
| 3 | (v0.12.1+) in-app disclosure 文言を Preferences セクション内に配置 | TS + locale |
| 4 | (v0.13+) 案 B (disabled palette item) を再評価。ユーザーフィードバックを見てから | TS |
| 5 | (v0.13+) 案 C (ステータスバー) は引き続き不採用。Safe Editor の chrome 哲学を優先 | - |

## Open questions (明示承認待ち)

- **案 D 採用の最終判断**: live mode 着地後に「Preferences を増やす」是非をユーザーフィードバック込みで判断
- **disclosure 文言の最終形**: リーガル確認が必要か。v0.12.1+ の App Store submission 時に Apple レビューフィードバックがあれば文言を修正
- **disabled 状態の "Apple Intelligence を有効化" リンクの飛び先**: macOS 15+ で `x-apple.systempreferences:` URL scheme が Apple Intelligence 設定を開くか確認
- **"first-time tooltip" のような 1 度きり UI を将来追加する可能性**: 1 度きり UI は実装 / 状態管理が複雑。基準を "1 セッション" / "1 アプリ起動" / "1 永続" のどれにするか

## 参照

- `docs/apple-local-assist-v0.12-design-review.md` — section 7 (UI 露出経路は 1 つだけ) / 設計選択 / 残った不確実性
- `docs/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" (App Review 5.1.2(i) / in-app disclosure 要件)
- `docs/apple-local-assist-live-helper-plan.md` — live mode が入るときの 4 状態マッピング
- `src/hooks/commandPalette/useCommandPaletteController.ts` — 現状の gate 実装
- `src/hooks/agent/useAppleAssistAvailability.ts` — 現状の 4 状態 state holder
- `src/lib/locale/appleAssist.ts` — 4 状態 + 5 operation の locale 文言 (現状 command palette 以外未使用)
