# 書き出し排他修正・UI-F1 合評

Status: Review ready
Scope: 8cd44a21 → 35b15362（実装2コミット）
Authority: Evidence
Date: 2026-09-10

## 修正と進行

外部レビューで前回P3 CLOSED、HTML writer/確認とImport表示GOを受領。
export modal排他P2によりE4bはHOLDだった。以下の修正はローカル確認済み、外部再レビュー待ち。

- **0e371fbc:** 3形式の開始を共通attemptで管理。preflight中なら最新の開始が所有者となり、
  旧完了はrequestをpublishしない。modal表示後は全形式の追加開始を拒否する。
  Cancel/Confirmは所有権を解放し、Cancel後も古いpreflightは復活しない。
  preflight完了時のtab/session/workspace検証、現役の失敗だけを通知する処理も追加。
- **nativeメニュー:** blocking modal中はQuit以外のactionを遮断。DOMのfocus/inertを迂回するeventを入口で止める。
  前回資料の「nativeメニューも遮断済み」は当時の実装と不一致だったため訂正した。
- **35b15362 / UI-F1:** 既存7テーマを日常4枚・演出3枚に分類し、静的な紙面サンプルを付けた。
  既存のテーマID・onThemePreferenceChange、説明、演出強度4段階、文字サイズ等を維持する。
  aria-pressed、枠とチェックで選択を示す。プレビュー用の演出エンジンや文書レンダラーは作らない。

書き出しwriterの所有権や出力内容は変更していない。設定カテゴリ全体の再配置、
新しいフォント/行間/動作軽減設定、Assistモデル管理はこの差分に含まない。

## 検証

今回実行したローカル証跡。CI成功、実機受入、Apple配布の証跡ではない。

| 検証 | 結果 |
| --- | --- |
| Frontend | 253ファイル / 2,198件成功 |
| App Store surface | 113件成功 |
| typecheck / Vite build | 成功 |
| native App Store preview build / codesign verify | 成功 |
| Rust | 無変更・今回再実行なし。前回383件を今回値に混ぜない |
| git diff --check | 成功 |

修正前は書き出し/nativeメニューの追加テスト6件が失敗し、修正後に成功。
PDF/EPUB preflight→HTML→Cancel→旧完了、各形式のmodal中の追加開始拒否、
native export/Viewの拒否とQuit維持を固定した。
既存テストで同時にPDF/EPUBを開いていた箇所は、Cancelしてから次形式を開く契約へ更新。

テーマは3言語で全7IDの実state切替と唯一の選択状態、選択説明を確認。
既存SettingsPreferencesPaneの演出強度/文字設定/配布境界テストも継続成功。
Viteのchunk警告・jsdom canvas未実装出力は既存どおりで、build/testは成功。

## 表示確認

実SettingsPreferencesPane＋PreferencesDialogのローカルstate fixture。
[ダーク 960×640](settings-dark-960.png) / [演出テーマ 960×640](settings-ambient-960.png)。

設定内容だけがスクロールし、固定のCloseが残る。7カードに到達でき、
ダーク・江戸彼岸・深海・CRTのクリックと、Tab＋Spaceで深海の選択を確認した。
静的サンプルは配色の目安で、テーマ演出の再現や全7テーマのnative描画合格ではない。
fixtureは永続化・native連携を呼ばず、再起動/別窓同期の証拠には使わない。

## レビュー依頼と次

1. 旧preflightの完了/取消後復活と、modal表示中の別形式開始を止められているか。
2. nativeメニュー遮断とQuit例外が他のmodalで回帰していないか。
3. テーマの7ID・選択・演出強度・既存設定の到達性が保持されているか。

nativeでのメニュー→遅いpreflight→形式変更、Esc/Tab、再起動後テーマ/別窓同期、
IME・VoiceOver・200%は未受入。HTML/PDF/EPUB成果物と取り込みの実操作も残る。
次はUI-F2の設定カテゴリ・文字設定・Help導線を整理する。
