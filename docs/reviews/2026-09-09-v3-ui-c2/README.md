# UI-C1追修正・UI-C2 提案確認導線

Status: Implemented; external review and native end-to-end acceptance pending
Scope: C1の小修正、別窓から該当提案への移動、結果通知の照合
Authority: Review evidence
Last reviewed: 2026-09-09

比較基点 `7da8f2b9`、ブランチ `codex/v3`、C2実装 `16e438eb`。
オーナー提供レビューでUI-B R3〜R5 CLOSED、LA-0 GO、UI-C1 GOを受領。
今回のC1追修正/C2は作成者側の実装・検証であり、外部GO判定はまだない。

| コミット | 区切り |
| --- | --- |
| `5e57d512` | C1ロック説明、hover除外、停止待ちの記録、旧ownershipコメント |
| `6da0f6f9` | ブラウザーで判明したdisabled CSSの後段上書きを修正 |
| `16e438eb` | UI-C2確認導線とApply/Discard通知の3 ID照合 |

## C1の修正

説明は3言語とも反映・破棄ができない旨に統一。hoverはenabledだけに適用。
実表示では後段のwriting-polish.cssがdisabledを上書きしていたため、そこへ
cursor:not-allowed / opacity:.5をまとめ、重複を除いた。

受入記録は「生成中は生成状態を表示。停止待ち中は前案を閲覧できるが反映・破棄不可」へ修正。
別窓の冒頭コメントも、mainがproposal/Diff/Applyを所有する現在の構造に合わせた。

## C2の動作

完了した提案がある場合、別窓の対象詳細より上に「この提案を見る」を表示する。
生成/停止待ち中は無効。失敗/取消後は前案のIDを保持し、本体が現在の有効性を判断する。

1. 別窓がconversationId + requestId + documentSessionIdを送信する。
2. nativeはapple-assist callerと配布レーンを確認。各IDの空、制御文字、200 bytes超過、余分なフィールドを拒否する。
3. mainは開いたタブのsession、最新proposalの3 ID、元文章の有効性を確認する。
4. Reader/モーダル/画像表示中は拒否。対象が有効なら既存タブ選択を通す。
5. 切替後にも照合し、main専用commandで本体を前面にして、該当提案regionへfocusする。
6. 同じ3 IDの結果を別窓へ返す。不一致/閉じた文書/stale/streamingは移動を拒否する。

確認の応答待ちは5秒で失敗案内へ戻る。これはfocus導線だけのタイムアウトで、
生成完了や取消完了を推定しない。新しいwindow label、path、本文、backend指定は受け取らない。

Apply/Discardの結果にもdocumentSessionIdを追加した。別窓は現在レビュー可能な3 IDに一致し、
新しい生成要求がない場合のみ受け付ける。以前のrequestや再オープン後のsession、欠落IDは無視する。
一致する失敗は会話を残し、一致する反映/破棄は会話を終える。

source更新・自動保存は追加していない。Applyのexact claim・stale再検証・単回buffer反映・Undoと、
helperの終了/取消mutexは既存のまま。[所有者の正本](../../v3-local-assist-ownership.md)。

## 検証

| 種類 | ローカル結果 |
| --- | --- |
| frontend全体 | 243ファイル / 2,109テスト成功 |
| App Store表示境界 | 10ファイル / 111件成功 |
| Rust | 383件成功 / 2件ignored / 失敗0 |
| typecheck / cargo fmt check | 成功 |
| Vite / App Store native preview | 最終実装のad-hoc appビルド成功 |
| 最終配置変更後 | 関連20件・typecheck成功、native preview再ビルド成功 |
| bundle署名整合 | codesign deep/strict verify成功。提出署名・公証ではない |
| GitHub CI | この資料の数値はローカル実行。CI成功の主張ではない |

2,100→2,109は、3 ID純粋照合2件、本体navigation hook5件、別窓render2件。
既存の結果受信テストも完了proposalとsessionを伴う現行契約へ更新。
純粋照合は未実装時のimport失敗を確認後に追加したが、独立した旧実装の挙動redではない。
他は実装と併せたfocused回帰。最初のtypecheckで見つかったテストの型不足は修正した。

新テストは同じpathの別session、切替後focus、Reader/modal拒否、stale/streaming/消費済み、
native focus応答前のproposal置換、古い結果通知、取消後の前案ID保持を扱う。
イベントとnative focusはテスト用transportであり、OSの実ウィンドウ切替試験とは区別する。
全体試験には既存のcancel integration、Apply/stale/Undo境界試験を含む。

## 表示証拠と残る受入

[960×640の停止待ち表示](blocked-960.png)は既存C1の実component fixtureを現在のCSSで撮影。
案を破棄/文書へ反映ともdisabled、computed cursor:not-allowed、opacity:0.5、下端563pxを確認。
比較切替は操作可能。これはC1表示の証拠で、C2のnative focus成功の画像ではない。

C2のnative窓間focus、実System生成→停止→前案→Diff→反映→Undoは今回未実施。
前回の環境ではLocal Assistメニューがdisabledだったが、今回それを現時点の可用性として再判定していない。
本体最小幅/別窓最小サイズでの新導線、IME、VoiceOver、200%・全テーマは未受入。
既存のApp Store設定変更は保持し、提出・公開タグ・公開アセットは変更していない。

## 合評の依頼文

> 7da8f2b9以降のC1追修正とUI-C2をまとめてお願いします。
> C1の反映/破棄説明・disabled表示・停止待ち記録が実装と一致すること、
> C2が今のconversation/request/document sessionに一致するproposalだけへ移ることを確認してください。
> 特に別タブ/同名文書/閉じて再オープン/新しい生成/遅いApply・Discard結果を見たいです。
> Native commandは固定用途・caller限定、mainで元文章を再検証し、Applyは既存の明示操作のままです。
> ローカル試験とnative実操作の受入は区別しています。次の実機確認では
> 小さい別窓からの「この提案を見る」→Diff→反映→Undo、およびReader/モーダル中の拒否をお願いします。
