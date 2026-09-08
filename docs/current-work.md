# Current Work

Status: Operational
Scope: v2.9日常品質強化とTestFlight候補
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.8は2026-09-08オーナー報告で公開済み。追加依頼により、v3前の日常品質強化を
**v2.9 / 2.9.0** でまとめる。外部レビュー `hazakura-v3-daily-use-audit.md` を参考に、
現行ソースで再現・修正・回帰検証し、TestFlight候補を準備する。

## Active Queue — v2.9品質レビュー

1. **実装済み:** Q-01–Q-07と隣接する保存・復旧・Local Assistの保全。
   2026-09-09のローカル実機追試でPDF末尾空白を追加修正し、署名候補を再作成。
   [品質レビュー](reviews/2026-09-08-v2.9-quality-hardening.md)に対応表・試験・限界を集約。
2. **外部再レビュー受領・修正:** N1（空CRLF復旧）・N2（改行なしSave As）を再現修正。
   A1は完成HTMLの容量案内を追加し、10 MiB上限は維持。署名候補を更新する。
   再確認の重点: 保存完了後のlive session、detached復旧記録の寿命と容量、
   部分成功のUI追従、校正の機械検査を重点確認する。
3. **実機:** 同一候補でIME、VoiceOver、旧OS、Apple署名候補の再起動、
   Local Assistの追加受け入れ、HTML全体の目視を確認。
   本全体PDFは未保存章を含む8ページで全章・画像・末尾を追試済み。
   出力前の未保存表示も修正したため、署名候補をcd6556daから再構築済み。
   短文のLocal Assist別窓・生成・取消・前案保持・明示反映・Undoはローカルpreviewで追試済み。
   ad-hoc App Sandbox診断でも単独Save As→再起動→復元→再保存を実byteまで確認済み。
4. **配布:** [2.9.0候補](releases/2.9.0-source-tag.release.md)の署名・版数・source・SHAを照合。
   外部レビューでコード変更があれば再構築。AppleへのuploadとTestFlight配布は承認後。

System-only改善とC-1/C-2のHOLDを維持する。v3.0はAFM活用と共通基盤、v3.1は
任意モデルのDL・管理・切り替え。正本は `docs/v2.9-v3-local-assist-plan.md`。
既存Apply・Undo・no auto-saveとR2-cの完了/取消mutex境界を広げない。

## Held / Outside this candidate

- C-1/C-2、MLX M-0b、任意URLモデル、provider追加、tool calling、network fallbackは対象外。
- 長文の性能測定は解析・sanitizeの基準値のみ。105k文字のWebKit追記・Undo・スクロールと
  7テーマの代表画面は追試済みだが、入力遅延・Reader・全テーマの性能計測は未確認。
- 固有名詞・意味保持は自動検査だけで合格にしない。全テーマ・IME・VoiceOverをjsdomで代替しない。
- v2.8の公開build/source対応と過去pkgの実機結果は今回の候補証跡へ転用しない。

## Sources

- `docs/current-status.md` / `docs/handoff.md`: 現状と引き継ぎ
- `docs/roadmap.md` / `docs/v2.9-v3-local-assist-plan.md`: 版別方向
- `docs/security-boundary.md` / `docs/assist-surface-strategy.md`: 安全境界
- `docs/smoke-checklist.md` / `docs/release-pre-check.md`: 実機・配布前の確認
