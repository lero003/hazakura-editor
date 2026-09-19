# v3.1 I-0a — HTML文書言語の同期

Status: Implemented — source / automated test evidence only
Scope: メイン窓とLocal Assist分離窓のHTML `lang`
Last reviewed: 2026-09-19

## 結論

表示言語が日本語またはかな表記でも、HTMLルートの `lang` が初期値 `en` のままになる
不整合を修正した。メイン窓とLocal Assist分離窓の両方で、表示言語 `en` は `en`、
`ja` と `kana` は `ja` に対応する。

これは補助技術へ表示文言の言語を伝えるための小修正であり、bundleの対応言語宣言、
英語翻訳の完了、VoiceOver受け入れ、海外販売開始を意味しない。

## 変更境界

- `documentLanguageForMenuLanguage` に対応規則を集約した。
- メイン窓は `useAppPreferences` の表示言語変更時に `document.documentElement.lang` を同期する。
- Local Assist分離窓も保存済み表示言語から同じ規則で同期する。
- Markdown source、保存、生成、Assist能力判定、App Store / Developerレーン分離は変更しない。
- 新しい言語、依存、bundle localization、ストア設定は追加しない。

## TDD証跡

実装前に次の2ケースを追加し、いずれも期待値 `ja` に対して既存値（メイン窓は `en`、
分離窓は空文字）となる失敗を確認した。

1. 保存済み `ja` の初期反映、`kana` の `ja`対応、`en`への再切替。
2. Local Assist分離窓で保存済み `ja` を反映し、別窓からの `en` / `kana` 変更へ追随。

実装後のfocused test:

```text
Test Files  2 passed (2)
Tests       22 passed (22)
```

## 内部レビュー

初回レビューでは、`en` 以外を一括で `ja` にすると将来の言語追加を誤分類するとのP3指摘が
あった。`switch` と `never` の網羅性チェックへ変更し、新しい `MenuLanguage` を追加した際は
対応規則を明示しない限りtypecheckで止まるようにした。Local Assistの `storage` event追随も
テストへ追加した。再レビューはfindingなし。

## 自動検証

- `npm run typecheck`
- `npm test` — 288 files / 2,567 tests passed
- `npm run build:vite` — passed（既存の500 kB超chunk警告あり）
- `npm run smoke:app-store-surface` — 10 files / 125 tests passed
- `python3 docs/international-launch/validate_metadata.py --self-test` — 14 self-tests passed
- `git diff --check`

## 未確認・次工程

- 実機VoiceOverでの読み上げ、フォーカス順、切替直後のネイティブUIは未確認。
- cold launchではReact effect適用前の短時間、HTML既定値 `en` のままとなる可能性がある。
- 英語主要導線、Help、ネイティブメニューの全量監査は次のI-0スライス。
- bundleの言語宣言、署名済み候補、App Store Connect設定は未変更・未確認。
- 対象地域、価格、契約、税務、公開Support / Privacy URLはオーナー判断待ち。
