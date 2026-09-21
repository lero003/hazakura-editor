# Core AI 12B catalog・配布UX・出力復元 外部レビュー資料

Status: Review requested
Scope: PR #52の2026-09-22追加差分
Authority: Review evidence
Last reviewed: 2026-09-22

## 結論

Gemma 4 12BをApp Storeレーンの固定catalogへ追加し、既存のApple-hosted managed download、
resource manifest検証、モデル選択、Local Assist、削除へ接続した。Developerレーンは空のまま。
任意URL/path、ローカルimport、製品内変換、network fallback、自動download、auto-applyは増やしていない。

この差分は**ソースとローカル実行を外部レビューへ渡せる段階**。12B archiveのApple upload / processing、
CDN materialization、32 GB対象機Internal TestFlight、built appのVoiceOverは次の別ゲートである。

## 変更

1. **12B catalog**: 固定model ID / asset pack ID / catalog version / resource manifestをRustへ追加。
   E4Bと12BだけをApp Store catalogへ出し、検証済みmaterialized pathだけをhelperへ渡す。
2. **設定UX**: download量、展開後使用量、推奨メモリ、license要約を表示。Rustが
   `hw.memsize`を読み、推奨値未満ではdownload開始前に確認するが禁止しない。
3. **状態競合**: model-state eventを購読してからsnapshotを取得し、取得中のeventより古い
   snapshotを採用しない。購読失敗時はsnapshotだけで継続する。
4. **12B出力復元**: 完全な外側`HAZAKURA_TEXT` envelopeだけを除去。本文がmarkerを含む場合や
   埋め込みmarkerは残し、不完全なstream envelopeはUIへ出さない。
5. **CI互換**: macOS 27専用Background Assets selectorをSDK compile guardへ入れ、
   macOS 26 SDKではunsupported fallbackだけをコンパイルする。

## 固定artifact

| Item | Value |
| --- | --- |
| Model ID | `apple:core-ai:gemma-4-12b-it-int8-v1` |
| Asset pack ID | `hazakura-coreai-gemma4-12b-v1` |
| Catalog version | `2026.09.20.1` |
| Expanded bytes | 14,698,433,203 |
| Local `.aar` bytes | 9,148,924,300 |
| Local `.aar` SHA-256 | `208bc19246665964a6fb910503ee1e2e20ff4830d378901d9a651a50837a10eb` |
| Resource manifest SHA-256 | `cbb81f30fbff9171e5001acd3305a9b36d1dd06ba6fac607edb7618ac3bd6ac1` |
| Recommended memory | 32 GB |
| License status | `reviewed-apache-2.0`; upstream conversion license原文も保持 |

`.aar`と展開stageは`.hazakura/coreai-production/`にありGit対象外。archiveのローカル生成成功を
Apple CDNやTestFlightの成功として扱わない。

## 実モデル評価

M4 Max / 128 GB、distribution Core AI helper、同じ18 fixture、1 repeatで比較した。

| Run | Result |
| --- | --- |
| 変更前 | 14/18で`noInternalMarkers`だけ失敗。12Bが外側prompt envelopeを復唱 |
| 変更後 | 18/18ですべての機械check通過。cancel後の再生成も通過 |

原稿中の事実、数値、リンク、コード、表、引用、否定、絵文字を守る個別checkは通った。
これは機械的な破損検査で、意味品質の人手採点や対象メモリ機の性能評価ではない。

## 検証

- `npm run typecheck`
- `npm test`: 298 files / 2,666 tests、project scripts 24 tests
- `npm run build:vite`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml`: 424 passed / 2 ignored
- `swift test --package-path src-helpers/apple-assist`: 49 passed
- `npm run smoke:app-store-surface`: 131 passed
- `npm run build:app-store-preview`: sandbox外で成功。3 helper、Background Download extension、
  ad-hoc署名、deep verificationまで確認
- Vite fixture: 1200 x 820と640 x 820を目視。狭幅でbutton textが折り返さないよう修正し、
  model metadataとmemory warningに重なりなし
- 12B production helper: 18/18機械check通過

## 外部レビューで見てほしい点

1. SDK guardがmacOS 26 SDKのObjC compile失敗を正しく閉じ、macOS 27 runtime分岐を変えていないか。
2. `hw.memsize`をGiBへ落とす判定と「警告して継続可」のUXが妥当か。
3. 12B manifest / asset pack identity / byte size / SHAの接続に食い違いがないか。
4. 購読後snapshot + generation判定が、通知取り逃しと古い巻き戻しの両方を閉じているか。
5. 外側envelope除去が、利用者本文や埋め込みmarkerを消す経路を作っていないか。
6. source / local artifact / CDN / TestFlight /対象機 / VoiceOverの証拠境界を越えていないか。

## 未確認・次ゲート

- PR #52の`frontend` / `native` CI（push後に確認）
- macOS 26 SDKでのguard fallback compile（PRの`native` jobを正本にする）
- 12B `.aar`のApp Store Connect upload、processing、CDN materialization
- 32 GB対象機でのdownload、load、初回specialize、peak memory、生成、cancel後再開、削除
- built appの設定画面、システムメニュー、VoiceOver、最大Dynamic Type
- AOT artifactと正式な人手bake-off
