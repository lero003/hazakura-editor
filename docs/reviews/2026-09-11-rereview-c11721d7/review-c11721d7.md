# Hazakura Editor UI再レビュー — c11721d7

- 対象: `lero003/hazakura-editor`, `codex/v3`
- HEAD: `c11721d79ae1f3265d4b485fe43388b44f052a17`
- 比較基点: `2438ef1f953b14ecf4b5ea30b3c39cbfa6bd30b5`
- 差分: 9コミット。前回R1〜R8に対する修正を中心に確認。
- 判定: **R6は再オープン。P2の指摘2件、P3の指摘1件。全8件クローズはまだ受け入れない。**
- リポジトリへの書き込み、commit、push、App Store作業への変更は実施していない。

## 確認方法と限界

GitHubコネクタでHEAD、比較範囲、変更ソース、関連するコントローラ・キーボード処理・テスト・レビュー文書を確認した。
そのうえで書き出しの非同期制御を転記した最小モデルをNode.jsで、Quick Openのイベント処理を抽出したDOMをChromiumで実行した。

**これらは実アプリでもReact Hook統合テストでもない。** 状態・分岐・イベントの最小再現としての証拠であり、Tauri/WKWebViewの実機証跡ではない。リポジトリ全体を実行できる環境は作れていないため、全Vitest、typecheck、Vite build、署名、App Store面のテストは再実行していない。実装者報告の279ファイル・2,450件と独立検証を混同しない。

実行した再現物は `evidence/`。書き出し6ケース（正常2・問題再現4）、Quick Open 6ケース（改善確認5・残件再現1）。「全テストの何件に失敗した」という数ではない。

## F1 — P2: 形式切替の準備中にキャンセルしても、新しいダイアログが後から開く

**前回との対応: R6修正の新たな問題。R3の通常キャンセル修正とは別。**

### 該当コード

- `src/hooks/document/useDocumentExport.ts`: `beginExport`, `consumeExport`, `cancelHtmlExport`, `cancelPdfExport`, `cancelEpubBetaExport`, `exportPdf`, `exportEpubBeta`
- 特に188〜213行付近の所有者変更・取消条件、および各形式のpreflight後の同一attemptチェック。
- `src/hooks/app/useAppShellController.ts`: `cancel*ExportSession`
- `src/components/app/AppOverlays.tsx`: 419〜438行付近の形式ナビ、各 `onEnd*ExportSession` 配線。

### 再現手順

1. 本スコープを構成し、HTML書き出しダイアログを開く。
2. 形式ナビでPDFまたはEPUBを選び、章読込を未解決のまま保留する。
3. まだ表示されているHTML画面でキャンセルボタンまたはEscapeを押す。
4. 保留した事前検査を完了させる。

期待: キャンセル後はどの形式のダイアログも開かない。
実装上の結果: 一度閉じるが、事前検査の完了でPDF/EPUBの要求がセットされ、再表示する。

### 原因

`beginExport(next, { replaceOpen: true })` は、直前の画面を残しつつ、`exportAttemptRef.current` を次形式の `preflight` に置き換える。
旧画面のキャンセルは旧形式を `consumeExport(old)` に渡すが、これは「同じ形式・modal相」のときしか所有者を消さない。
この条件には一致しないため、画面と草稿は消えても新しい非同期attemptは生き残る。

```text
表示: HTML          / owner: EPUB preflight
HTMLをキャンセル    / owner: EPUB preflight のまま
EPUB準備が完了      / owner: EPUB modal → EPUBが表示される
```

コントローラの `cancel*ExportSession` は草稿をclearしてから元のcancelを呼ぶだけなので、この非同期attemptの失効を追加では行わない。

### 検証

抽出型の制御フローでHTML→PDF、HTML→EPUBの両方について再現。Reactで描画した実測ではない。
ソース上でも、キャンセル後にattemptを失効させる処理がないことを確認した。

### 修正要求

利用者のキャンセルは「表示形式の要求を消す」ではなく、**書き出しセッション全体の終了**として扱う。
表示要求、切替準備中のattempt、草稿を同じ終了口で破棄し、後着結果が再表示しないようrequestId/世代を失効させる。
実I/Oを中断できない場合でも、その完了結果を採用しない論理取消は必要。
形式切替内部の旧画面撤去はセッション終了とは分ける。

既存のR6テストと同じdeferred Book Scopeを使う回帰テスト案を `evidence/add-to-useDocumentExport-tests.ts.txt` に付けた。このテスト案そのものは未実行。

## F2 — P2: 切替準備の例外後、残ったPDF/EPUB画面が確定不能になる

**前回との対応: R6の「失敗したら直前の画面を残す」が、操作の復旧まで成立していない。**

### 該当コード

- `src/hooks/document/useDocumentExport.ts`: `exportPdf` / `exportEpubBeta` のcatch
- 同ファイル: `confirmPdfExport` / `confirmEpubBetaExport` 冒頭の `consumeExport` ガード

### 再現手順

1. PDF書き出しを開く。
2. EPUBへ切り替え、次形式の事前検査を保留する。
3. 次形式の事前検査を例外で終了させる。
4. 残ったPDF画面の「書き出し先を選ぶ」を押す。

期待: PDFの有効な画面に戻り、PDF書き出しを続けられる。
実装上の結果: PDFのrequestは残るが、書き出し所有者はnull。PDFのconfirmは冒頭でreturnする。
EPUB→PDFの例外でも同様。

### 原因

新形式のcatchは `exportAttemptRef.current = null` にするが、旧形式のmodal ownerを復元しない。
旧画面を描くrequestはそのままなので、**見える画面と、確定を許可する内部状態が分離**する。

```text
表示: PDF           / owner: EPUB preflight
EPUB準備が例外終了   / owner: null、PDF requestは残る
PDFの確定           / consumeExport("pdf") == false → 無反応
```

さらに準備中にも旧PDF/EPUBの確定ボタンが有効なままだと、ownerが別形式のpreflightなので同じガードで無反応になる。準備中に旧形式を確定できる設計にするか、一時無効化して理由を見せるかを明確にする必要がある。

### 検証と限定

抽出型の制御フローでPDF→EPUB例外、EPUB→PDF例外を注入し、旧画面の要求が残る一方、確定処理の入口を通過できないことを確認した。
ここでいう失敗は **buildPreflightByScopeが例外を投げたケース**。画像や章の読込失敗が警告・issuesとして正常returnするケースまで、このcatchに入るとは主張しない。
HTMLのconfirmは別の実装なので、HTMLにも同じ「confirmガードで必ず無反応」を一般化しない。

### 修正要求

「表示中の有効な要求」と「切替先の準備」を別に持つ。
成功時だけ表示側を入れ替え、失敗時は準備だけ破棄して旧要求の実行権限を維持する。
単にnullにしたrefを後から無条件で戻す方法は、キャンセル済み・後続要求の所有者まで復活させうるため避ける。現在のsessionId/transitionIdと一致するときだけ処理する。

F1とF2は共通の状態モデルの問題なので、1スライスで修正するのがよい。

## F3 — P3: Quick Openの結果へTab移動した後、Escapeで閉じない

**前回との対応: R5の主要な改善は確認できたが、同じキーボード操作経路に取消の残件がある。**

### 該当コード

- `src/components/editor/QuickOpen.tsx`: `handleKeyDown`（119〜148行付近）とdialogの `onKeyDown`（177〜185行付近）
- `src/hooks/workspace/useQuickOpenState.ts`: 開閉状態のみを所有
- `src/hooks/app/useModalKeyboardGuard.ts` / `useGlobalKeyboardShortcuts.ts`: Quick Open専用のEscape終了口は持たない

### 再現手順

Quick Openを開く → Tabで検索inputから結果ボタンへ移動 → Escape。

結果のEnter/Spaceは動くが、Escapeでは閉じない。Shift+Tabなどでinputへ戻ればEscapeで閉じられるため、完全な閉じ込めではなくP3とする。

### 原因と検証

Escapeを処理する `handleKeyDown` はinputにのみ接続されている。追加されたdialog全体のハンドラはTab trapのみ。
Chromiumで同じDOMイベント処理を抽出して確認したところ、Tab→Escapeは `open=true, closes=0`、input上のEscapeは `open=false, closes=1` だった。
同じ抽出再現でEnter/Space各1回の実行、右クリック時0回、Tab/Shift+Tabの循環も確認できた。

### 修正要求

Escapeをdialog全体の処理へ上げ、input上では二重取消を起こさないようにする。
`isImeComposing`の除外と、必要なpreventDefault/stopPropagationを維持する。
入力欄・先頭結果・末尾結果のいずれでもEscapeが1回だけ終了口を呼ぶテストを追加する。

## 前回8件の再判定

| ID | 今回の判定 | 確認内容 |
|---|---|---|
| R1 | 元の指摘に対する修正を確認 | モーダル・separator・hidden/inert/aria-hiddenをcapture側で除外。実機受入は別 |
| R2 | 修正を確認 | 外側formに高さ、本文はflex:1/min-height:0/overflow:auto/align-content:start。他行を縮めない設計へ |
| R3 | 通常経路の修正を確認 | controllerが草稿を所有し、ボタンとEscapeは同じセッション終了口。R6準備中の論理取消はF1で残る |
| R4 | 元の2桁入力問題の修正を確認 | draft文字列を持ち、blur/Enterで確定。空文字確定で勝手に下限にしない |
| R5 | 主要部分を確認、F3残り | click(detail=0)によるキー実行、pointer主ボタン判定、自身のTab trap。Quick Openの結果上Escapeは追加修正 |
| R6 | 再オープン | 正常切替の旧request保持は成立。取消と例外時の状態管理が未完了 |
| R7 | 修正を確認 | pathlessを有効条件へ追加。空の新規文書をdirtyにせず、既存ロックを維持 |
| R8 | 修正を確認 | composer前に利用不可理由を出し、textareaとaria-describedbyで接続 |

「修正を確認」はソース・今回の限定的な再現における判定であり、macOSネイティブ受入済みという意味ではない。

## 最小の次スライス

まずR6だけに絞り、以下の状態を区別する。

```text
ExportSession
  sessionId / document identity
  visibleRequest       // 現在表示中で有効な要求
  pendingTransition    // 切替先format・transitionId・準備処理
  drafts               // 同一セッション内で保持する設定
```

成功時はvisibleRequestを入れ替える。例外時はpendingTransitionだけを消す。利用者キャンセルはセッション全体を失効させる。新しい切替は古い準備結果を無視する。通常の別コマンドからのexportは、表示中のsessionがある間に二つ目のmodalを作らない。

次いでF3を小さく修正する。書き出しライタや保存先の安全境界を広げる変更は不要。

## 必須にしたい回帰条件

| 条件 | 期待 |
|---|---|
| 旧HTMLを残したEPUB/PDF準備 → Cancel | 解決後にもどのダイアログも復活しない |
| 同上 → Escape | ボタンと同じ終了・草稿破棄になる |
| 旧PDF/EPUBを残した準備 → 例外 | 旧形式が再び確定できる |
| 切替準備中の旧形式Confirm | 明示的に禁止して理由を示すか、仕様どおり実行。押せるのに無反応にはしない |
| 次形式の連続切替 | 最後の要求だけが有効で、ダイアログは常に最大1つ |
| キャンセル後に新しいexportを開始 → 古い準備が後着 | 古い処理は新セッションに干渉しない |
| Quick Openのinput/各結果でEscape | 全て1回だけ閉じ、背後の別UIへ取消が漏れない |

## テスト・証跡について

保留Promiseを使ったHookテストは、遅い準備を決定的に検証する適切な方法であり「好み」ではない。ただし新しいR6テストは準備保持→成功と通常の二重起動拒否まで。失敗・キャンセル・連続切替は別の不変条件として追加すべき。

401フレームで枠が消えなかった証跡は正常切替の視覚的証拠として有用だが、取消・失敗時の意味的な動作までは保証しない。

`AppWorkspace.test.tsx`の単発失敗は、このレビューではログ・再現を独立確認していない。再実行が緑というだけで負荷原因と断定せず、失敗したテスト名・assertion・ログ・再現条件を未解消のフレークとして残す。

docsには古い件数や「Vite build ✓（要再実行）」が残っている。コード上のblockingとは分けて、最終検証のcommit・件数・実施/未実施を1つの表へ統一したい。
WKWebView、VoiceOver、日本語IME、WebGL合成、信号機、配布候補.appは引き続き実機受入が必要。

## ソース

すべて以下の固定コミットを基準に取得した。

`https://github.com/lero003/hazakura-editor/tree/c11721d79ae1f3265d4b485fe43388b44f052a17`

主要ファイル:

- `src/hooks/document/useDocumentExport.ts`
- `src/hooks/document/useDocumentExport.test.tsx`
- `src/hooks/app/useAppShellController.ts`
- `src/components/app/AppOverlays.tsx`
- `src/components/editor/QuickOpen.tsx`
- `src/components/commandPalette/CommandPalette.tsx`
- `src/lib/focusTrap.ts`
- `src/features/editor/readerKeyboardOwnership.ts`
- `src/components/editor/preview/EBookPane.tsx`（R1コミット差分）
- `src/components/app/SettingsPreferencesPane.tsx`
- `src/features/workspace/primarySaveEnabled.ts`
- `src/components/appleAssist/AppleAssistWindowApp.tsx`
- `src/styles/dialogs.css`
- `docs/reviews/2026-09-12-external-review-r1r8/README.md`
