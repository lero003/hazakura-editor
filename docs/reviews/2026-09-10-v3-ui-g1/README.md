# UI-G1 — 状態表示・Help整合・reflow予備確認

Status: Review ready; UI-G acceptance incomplete
Scope: 9ab48bab → 799f649a（実装3コミット）
Authority: Evidence
Date: 2026-09-10

## 修正と進行

F2 GO・テーマ説明P3 CLOSEDをオーナー提供の外部レビューとして受領。
Settingsの未probeをunsupportedと断定する既存P2-lowを修正し、UI-Gの横断確認へ進んだ。

| Commit | 変更 |
| --- | --- |
| 138e0cc3 | probedをSettingsへ伝達。未確認と非対応を区別し、Local Assistがactiveなら通常Settingsでも既存probeを実施 |
| 56d80817 | Local Data Disclosure / Privacy Policyの画像通信と明示Applyの説明を修正 |
| 799f649a | 低い有効表示領域で設定ナビ・Helpの固定領域が本文を押し潰さないCSS調整 |

未確認の文言は3言語。probeの5秒期限・遅い応答拒否・可用性stateの所有者は既存hookに残す。
起動時に新しくprobeせず、設定を開く明示操作が入口。Assistがactiveでなければ未確認のまま。
Settingsの差分設定の説明は、提案自動適用ではなく「反映後の変更履歴の差分」に揃えた。

Helpには、既定オフのremote image、明示許可後の有界HTTPS、ローカル画像権限との区別、
AI network fallbackなし、mainで明示Apply→未保存→Undoを記載。
新しい通信・生成・書き込み経路を作った変更ではなく、既存仕様への文言修正。

高さ480 CSS px以下ではヘッダー余白を縮め、カテゴリは横スクロール。
Helpの説明・本文・脚注は同じスクロール領域へ入れ、どの文言も削除しない。

## 今回のローカル検証

- Frontend: **256ファイル / 2,209件成功**。
- App Store surface: **117件成功**。F2で追加された文字サイズ4件を含む再実行値。
- 可用性hook＋Settingsの結合テスト: 3言語で未確認→確認済unsupportedを検証。修正前に3件失敗。
- 既存の確認済unavailableテストはprobed=trueを明示して、未確認と区別。
- 可用性hook/Help/CSSの近接46件、最終Privacy PolicyのHelp21件も成功。
- typecheck / Vite / native preview build / codesign verifyは最終文言・CSSを含むコードで成功。
- Rust無変更・今回再実行なし。GitHub CI成功とは扱わない。
- jsdom canvas未実装出力とVite chunk警告は既存どおり。

## 表示確認

[未確認状態 960×640](availability-960.png) /
[Settings reflow 480×320](reflow-settings-480.png) /
[Help reflow 480×320](reflow-help-480.png)。

実componentのブラウザーfixture。初期状態はprobeを行わないfixtureで、
「状態はまだ確認できていません」と表示されることを確認。
小さい有効領域でClose・切替を残し、本文へスクロールできる。HelpはTab→PageDownも確認。

480×320は960×640を拡大した場合の狭い有効領域を想定した**reflow予備検証**。
実ブラウザーzoomやnativeの200%設定を実行したという意味ではない。
画像・原稿・native probeを使う実アプリ全体のsmokeとは区別する。

## UI-G受入チェック表

| Gate | 今回の証跡 | 次に必要な実操作 |
| --- | --- | --- |
| Settings未確認/非対応 | 実hook結合テスト3言語 | native起動→通常Settings→probe結果 |
| 設定/Helpの低い画面 | 960×640、480×320 fixture | native 200%でClose/カテゴリ/Help本文 |
| 読み上げ | aria-describedbyとDOM/focusの自動試験 | VoiceOverで未選択テーマ説明、Reader背景sidebar仮想カーソル |
| 編集/Reader往復 | 全suiteの既存DOM・Undo回帰試験 | 実IME入力→Reader→章編集→Undo |
| 設定永続化 | 永続化コードは変更なし、既存suite | 7テーマ/4文字サイズ→再起動→別窓同期 |
| 出力/取り込み | 既存preflight/保存/拒否テスト | 成果物を開く、取り込み→修正→保存/Undo |
| Local Assist C2 | 所有権・ID/取消の既存テスト | 実Systemで別窓→proposal→Apply/Undo |

全gate合格までUI-G/v3完成とはしない。次はG1合評と、上記native受入の具体的な実行記録。
