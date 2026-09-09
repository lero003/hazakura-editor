# UI-A1 design QA

Status: Partial visual comparison; implementation review ready
Scope: 通常編集外枠。全画面のfidelity合格ではない
Last reviewed: 2026-09-09

## 比較条件

添付 `20260909_hazakura-ui-implementation/reference/screens/02-editor.png` と `19-dark.png` を、
それぞれ実装のlight/dark画像と同じ画像入力に並べて目視した。
実装viewportは1440×850。元資料は外枠/見出し付き3200×2152、内部アプリの論理幅1440。
資料のPNG全体のピクセル一致は判定しない。冒頭のサンプル文章を使用しているが、
実装は無題未保存・workspaceなし・Assistオフ、sidebar280/Preview42%など既存設定のため
資料の保存済みworkspace・複数タブ・sidebar225と状態が異なる。
原寸での完全同条件比較、参照HTMLの操作検証は未実施。

## 結果

| 項目 | 状態 | 判断/次の対応 |
|---|---|---|
| 上段66/タブ43/表示ツール48の分離 | 実装・目視確認 | 通常編集02に合わせた行構造。書き出し統合はUI-E |
| Lightの静かな緑と紙色 | 外枠のみ反映 | Editor/Previewの本文紙面は現行。新しい書体や余白はUI-B |
| Darkの配置 | 目視確認 | 既存テーマの色変数を使用。資料の濃緑への全面調整は未実施 |
| 狭幅960×640 | 目視/DOM確認 | 横はみ出しなし。既存ツールはicon表示に縮退、ラベルはアクセシビリティ名に残る |
| L Mode | ブラウザー操作確認 | 上段非表示、既存浮動導線で戻れる。本文保持 |
| 確認popover | 自動テスト | 0/1/複数、別セッション、対象名、通常EscapeとIME、focus復帰 |
| native最上段 | 未確認 | P1受入ゲート: traffic light/dragと操作部が競合しないこと。公開前に実機で確認 |
| 原寸fidelity | 未完了 | P2/UI-B以降: Previewカード/見出し下線/書体/余白/サイドバーは資料と異なる |
| 全テーマ/200%/VoiceOver | 未確認 | UI-Gと実機ゲート。今回のlight/dark結果から補完しない |

原稿保全の自動テストと外枠のブラウザー確認は通ったが、v3完成や公開Goの判定は行っていない。
現段階のレビューは配置・遷移契約に絞り、native受入項目とUI-B以降の差を残した状態で行う。
