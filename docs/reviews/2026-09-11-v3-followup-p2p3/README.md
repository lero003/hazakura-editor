# 外部レビュー follow-up（P2 / P3）— 2026-09-11

ドーン氏のレビュー（`codex/v3` = `da15773e` 実質最終ソース）で挙がった2件を閉じた記録。
どちらも「**設計の意図が実際の挙動に届いていない**」型で、データの壊れではない。

## P2 — 文字コードの1チップで、selected が常に「保存する文字コードを変える」側だった

- 指摘: `StatusBar` の select は「読み直す」群を DOM 上は先頭に置いているが、`value` は常に
  `save:<現在の文字コード>`。つまり selected option は必ず保存側で、ネイティブ select や
  キーボード / VoiceOver では選択中がそちらに見える。安全側（ディスク無傷の読み直し）を先頭に
  置いた狙いが実質的に弱まっていた。しかも保存側は将来の保存時に文字コード変換を伴う操作なので、
  「選択中」に見えていること自体が慎重にしたい状態。
- 直し: select を**アクション選択**にする。`value=""` の**中立 placeholder**（「操作を選ぶ」/
  "Choose an action"）を先頭に置き、selected は常にそれ。現在の文字コードは従来どおりチップの
  表示（`文字コード UTF-8`）が示す。操作を選んだら中立へ戻す（`event.target.value = ""` を明示）。
  aria-label は「文字コードの操作」/ "Encoding actions" に変え、状態選択ではなく操作選択であることを示す。
  使わなくなった `encodingAriaLabel` prop と未使用になった copy `encodings` は削除。
- 実測（実アプリの fixture、`New File` 後の実 DOM）: `encodingValue` が `"save:utf-8"` → **`""`**。
  見た目は変わらない（この select は `opacity: 0` で、チップの表示が可視の面）。
  変わったのは **selected state と支援技術から見た値**。
- テスト: `StatusBar.test.tsx` に「先頭が中立」「selected が中立」「操作後も中立へ戻る」を追加。

## P3 — 確認の選択メニューを開いたまま読書面へ入ると、メニューが残る

- 指摘: `WorkspaceModeNavigation` の open 状態を無効化する signature は
  `[contextKey, canNavigate, reviewTargets]` で、`readingOpen`（＝`canReview`）を含まない。
  読書中は確認ボタンだけ disabled になるため、「確認（複数候補）を開く → 読む」の遷移で
  popup の `open` が true のまま残る。押してもレビューへ遷移しないよう AppShell 側は
  ガードしているのでデータ事故ではないが、読書画面の上に操作不能な popup が残る UI 不整合。
- 直し: signature に `canReview` を足す（読書面へ入ると変わるので、既存の「signature が
  変わったら閉じる」effect がそのまま働く）。トリガーの有効条件と開いている条件が同じ由来になり、
  将来 `canReview` の条件が増えても同じ経路で閉じる。
- テスト: `WorkspaceModeNavigation.test.tsx` に「開く → `readingOpen` へ遷移 → メニューが消え、
  確認ボタンも無効」を追加（読み取り専用ガードではなく UI の契約として固定）。

## 検証

- `npm run typecheck` ✓
- 全 Vitest: **278ファイル / 2,430件** ✓（P3 の1件を追加。P2 は既存テストの書き換え）
- 実測: 上の「実測」1行（実アプリの fixture で DOM を読んだ値）
- Rust 無変更（`cargo test` 未実行）

## 残リスク

- 中立 placeholder の文言（「操作を選ぶ」）は、読み直す群が無い（未保存の新規文書）ときに
  唯一の群が「保存する」だけになる局面でも中立のまま。文言の妥当性は実機の体感で見てほしい。
- 可視の見た目は変わらないため、証跡はテストと DOM 実測（`status-encoding-neutral-1440.png` は
  チップが従来どおり「文字コード UTF-8」を出していることの確認）。
