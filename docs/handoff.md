# Handoff

Status: Operational
Scope: v3.2依存更新候補、次期メモ・縦書き方針、v3.1以前の引き継ぎ
Authority: Medium
Last reviewed: 2026-09-26

## v3.2品質強化・責務の整理（2026-09-26）

source候補を`main`へ統合・pushし、旧作業ブランチを削除した。
後続CIで見つかったL ModeのEscape登録競合を`2ee96b16`で修正し、
ローカル全テスト・型検査/Vite・App Store surfaceが通過。
旧依存更新PR 4件も閉鎖済み。レビュー対象を切り出した
[外部レビュー依頼](reviews/2026-09-26-v3.2-external-review-brief.md)と
[実機受け入れマトリクス](releases/3.2.0-dependency-acceptance-draft.md)を次の入口とする。
`5ba2a9a6`の[Quality CI](https://github.com/lero003/hazakura-editor/actions/runs/36234798000)は
frontend・nativeとも成功。最終コードの[Quality CI](https://github.com/lero003/hazakura-editor/actions/workflows/quality.yml?query=branch%3Amain)を
commit照合で確認する。修正後候補の実機・署名済み配布は未受け入れ。

保存・外部変更監視・開き直し・バックアップ一覧の遅延応答を、セッション・保存基準・
要求世代で防ぐ。Reactの状態更新内部でも入力や保存との競合を照合する。
AppShellからL Modeの表示復元、Assist候補レビュー・破棄確認、終了処理を分離。
EditorPaneから編集コマンド・装飾、書き出しからPDF/HTML生成とEPUBのZIP・章・リンク・
目次処理を分離した。エディタのライフサイクル、書き出し対象や画像許可の所有者は維持。
メニュー終了はAssist停止を待ち、メニュー・OS終了とも停止待ち後に未保存状態を再確認する。

frontend 2,783件 / 305 files、scripts 31件、Rust 483件pass / 3 ignored、型検査、
Vite、App Store surface 134件、fmt、ローカルApp Store ad-hocプレビューbuildと
静的sandbox smokeが通過。抽出した関数と元コードの照合、終了競合のred→green、
日本語書式→Undo、L Mode復元、本番Assistレビューhookの統合テストを含む。
[変更点と実機再確認項目](releases/3.2.0-quality-hardening.md)を参照。

依存更新・計画文書等の差分は品質強化とともにコミットし、`main`へpushした。
オーナーの簡単な実機試験は問題なしとの報告だが、修正後候補の実機・IME・VoiceOver・
書き出し・TestFlightは未実施。既存のbundleサイズ・Rust dead_code警告も残る。
次はL Modeの出入り、書き出しの章/リンク/画像、Assist生成中の終了を含め、同一候補を実機で受け入れる。

## 次期製品方向 — メモと縦書き（2026-09-26）

オーナー決定を `roadmap.md` と `post-v3.1-writing-completion-draft.md` へ反映した。
見直しメモ → 再開メモ → 編集ルールのひな形をメモ系の基本順とし、
縦書きReader → 縦書きEPUBも採用する。縦書きはLLM拡張を前提にしない。
編集ルールは自由記述のフォーマットへ注意・表記・例外を書き足すもの。
AIによるひな形・内容の候補作成は、メモを本文推敲に使う機能と分け、品質再評価後に扱う。
本文・メモの自動更新や、表記を強制する検査エンジンを採用したわけではない。

直近はv3.2候補の実機受け入れを優先。次のメモ設計で保存・原稿との紐付け・移動・削除・
位置の再指定を決める。版割り・出荷日は未確定。今回は計画文書のみで、機能実装や実機検証は行っていない。
文書検証は `git diff --check`、未追跡の計画詳細を含む追加差分の空白・リンク・公開文言の衛生確認が通過。

## 2026-09-25 v3.2.0依存更新候補

この節は当時の候補記録であり、現在のGit状態は冒頭を参照。

v3.1は審査通過・公開済み（オーナー報告）。source版を3.2.0へ進め、npm/Rust依存を
まとめて更新した。`@codemirror/view` 6.43.13はexact pin、Core AI SwiftPM runtime
revisionは維持。`ureq` 3へのHTTPS画像fetch移行と`window-vibrancy` 0.8を含む。
macOS 27のrelease proc-macro読み込み問題は`Cargo.toml`のbuild-overrideで回避し、
Swift helperの出力場所は`swift build --show-bin-path`から取得する。
GitHubの依存更新PR #46/#48/#49/#51はすべてローカル候補へ同版以上で反映済み。
PR自体はopenで、`main`には未反映。v3.2候補のCIは未実行。Node 26は現時点で
Currentのため、CIはLTSのNode 24と`@types/node` 24を維持する。
SwiftPMの上流HEADは現pinからCore AI modelsで12 commit、CoreAIKitで145 commit進み、
推論コードやcatalogに変更がある。新版が故障すると確認したわけではなく、
配布モデル適合の実機評価を今回から分けた。

`npm ci`、frontend 2,721件・scripts 31件、型検査、Vite、App Store surface 134件、
Rust 483件pass / 3件ignored、fmt、npm/Rust監査の脆弱性0件、両レーンの
v3.2.0プレビュー、ad-hoc sandbox署名smokeが通過。隔離Developerアプリでは
長い日本語原稿の描画・L Mode・保存・Readerを一部実操作した。Readerからの初回復帰で
位置が先頭に見えたが、再起動後の章199復帰は2回成功。再現性を確認する。
同じ隔離アプリで長文EPUB/PDF出力、HTTPS画像の表示とEPUB同梱、HTTP画像拒否を確認。
画像通信設定は試験後にOFFへ戻した。
`THIRD_PARTY_NOTICES.md`はv3.2のnpmとmacOS両architectureのCargo lock解決集合で更新。
残りはIME未確定入力、VoiceOver、画像/PDFの端ケース、ファイル衝突・復元、Assist、
Swift graphのlicense text確認、署名済みTestFlightのAssist/Background Assets、
macOS 26/Intelの実機受け入れ。
App Store `bundleVersion`は公開済みbuildを照合してから新規採番する。
[候補と実機マトリクス](releases/3.2.0-dependency-acceptance-draft.md)を参照。

## 2026-09-24 3.1配布モデルのE4B v2切替

build 155の16 GB MacでHazakuraの12Bがタイムアウトするというオーナーの実機報告を受け、
次のApp Store source catalogをE4B v2へ変更。12Bは新規取得・選択を止め、以前に検証した
packがある端末には削除行だけを残す。前版で12Bを選択していたらSystemへ戻す。
build 156 pkgは12B catalogを含むため審査候補から外す。E4B v2の16 GB TestFlightでの
取得・検証・生成、AOT、権利とnoticeの確認を終えるまで審査受入としない。
Osaurusの12Bが軽快というオーナー報告はMLX系との実行条件差の調査として残す。
Rust 482件pass / 3 ignored、frontend 2721件、scripts 31件、型検査、Vite、
App Store surface 134件、fmt、英語metadata文字数検査が通過。
clean source `adda8bbf`からbuild 157署名済みpkgを作成し、app/extension build番号157、
アプリ・pkg署名、notice、SHA-256、`sourceDirty: false`を確認。候補のpathとhashは
ignoredの`docs/internal/app-store-candidates/latest.json`にある。Apple送信・TestFlight
配信・16 GB実機受入は未実施。

## 2026-09-24 3.1英語掲載と審査候補

build 155はオーナー報告でTestFlight配信済み。機能実機確認は155で進行中。
英語Helpの旧説明（Core AI未配布・外部folder不可）と提出準備用のUI文言を修正。
en-US掲載文とApp Review Notesを12Bのみのcatalog、macOS 27+ Core AI条件、
Apple Intelligence OFF時の独立可用性、外部resource folder登録に合わせた。
Help実Markdownテスト23件、frontend 2720件・scripts 31件、型検査、Vite、surface 134件、
metadata検査14 self-testsが成功。clean source `3e4ea538`からbuild 156署名済みpkgを作成し、
app/extension番号・署名・notice・digestを確認。候補path/digestはignoredの
`docs/internal/app-store-candidates/latest.json`を参照。156のApple送信・TestFlight・実機・
審査は未確認。公式サイトは現状維持だが、公開Privacyの任意画像通信とCore AI説明の
実装との差は掲載前に訂正する。
最初のbuild 156試行は既定main profileのApp Group不足で停止し、build番号は復元された。
検証済みのmain/extension profileを環境変数で明示して再実行した。

## 2026-09-24 Core AIモデル管理の仕上げ

ダウンロード完了後の検証中に`Verifying`を通知。SHA-256開始前の途中通知と終了後の確定は
操作世代を照合し、UIは不定進捗と編集継続を示す。再取得の確認文は選択中かで変え、
選択中ならSystemへ切り替わり再取得後に手動で選び直す旨を明示する。更新ボタンは
「更新を確認して取得」に変更。Local Assist一覧は選択不可の理由を見た目と読み上げ名に
含める。frontend 2719件・scripts 31件、Rust 480件pass / 3 ignored、App Store surface
134件、Rust fmt、ローカル`npm run build`が通過。**build 154の署名済みpkgは含まない。**
次の署名済み候補で実Background Assetsの検証時間と画面遷移、再取得・更新、
VoiceOverでの一覧読み上げを受け入れる。

## 2026-09-24 Background Assetsのpause先行P2

再起動後のcontrollerにdelegateのpauseが先着すると後続通知を拒否する経路を修正。
delegate-observed pauseはprogress / finishedから最新版ensureへ再接続し、ユーザーの
明示的な取消・削除は遅延通知とsnapshot再接続を抑止する。再試行で抑止を解除し、
旧versionと古いcompletionは引き続き拒否。pause先行の失敗先行native回帰テスト、
Rust 477件pass / 3 ignored、Rust fmt、ローカル`npm run build`は通過。
**build 154の署名済みpkgはこの修正を含まない。** 実Background AssetsとTestFlightは
未確認。次の署名済み候補で取得中再起動・pause→再開・取消後の遅延通知を受け入れる。

## 2026-09-24 Local Assistのモデル別可用性

SystemモデルのApple Intelligence OFFは`disabled`。Core AIは選択したモデルの実読み込みで
独立判定する既存native経路を確認し、frontendのモデル状態変更・pack Ready時の再probe、
アシスト設定からモデル管理への導線、System無効時の案内を追加した。ユーザーの明示的な
Local Assist選択・再起動とモデル選択は維持。DLだけで自動有効化しない。
frontend 2716件・scripts 31件、型検査、Vite、App Store surface 134件と
ローカル`npm run build`は通過。
**build 154はこのsource変更を含まない。** 外部レビュー後の新候補で、Apple Intelligenceを
OFFにしたTestFlight環境から12B取得・選択・通常/streaming生成、Systemへの復帰を受け入れる。

## 2026-09-24 外部レビューP2追補

`352a0ffc`への2件の指摘をsourceで修正。Background Assetsの再起動後に届く進捗・完了通知を
最新版のensureへ再接続し、旧版通知と古い操作世代ではReadyにしない。Local Assistの`busy`は
約15.5秒で終了せず、最大8秒間隔で65秒の期限までprobeを続ける。native callback回帰テスト、
frontend 2710件・scripts 31件、Rust 477件pass / 3 ignored、型検査、Vite、App Store surface
132件、Rust fmt、`npm run build`が成功。ローカルの模擬通知とad-hocプレビューの結果であり、
実Apple配信・TestFlightの確認ではない。**build 153は追補を含まない。** clean source
`fa678ba2`からbuild 154の署名済みpkgを作成し、profile・署名・digestをローカル確認した。
候補のpathとSHA-256はignoredの`docs/internal/app-store-candidates/latest.json`を参照。
build 154は当時の受入候補だったが、後続のpause先行P2修正は含まない。

## 2026-09-23 当時のCore AI配布判断と確認ゲート（履歴）

この時点の初回Apple配信catalogはGemma 4 12Bのみ（最低16 GB・推奨24 GB）だった。
2026-09-24のE4B切替方針が優先する。外部レビューP2-01〜03はsourceで是正し、
削除→再取得→再検証、同サイズ改変、pack version変更、旧監視の遅延完了を回帰テストで固定した。
外部フォルダは本体の永続bookmarkとhelper用implicit bookmarkを分離し、`.aimodel`だけの
選択を親フォルダの権限と取り違えない。実際の署名済みsandboxでの通常/streaming生成、
完全終了後の選択復元、取消/切替、移動/切断の説明と再指定、登録解除後の元ファイル保持は
同一候補での受入待ち。clean source `6e76b443`から3.1.0 build 149の署名済みpkgを
作成し、署名・entitlement・digestを確認した。配布用profileの`.app`単体起動はmacOSに
拒否されるため、TestFlight install後に上記を受け入れる。source・ローカルテストを
TestFlight受入としない。build 149は後続の外部model選択UI修正を含まない。隔離ad-hoc sandboxでは
実E4B v2の登録・選択・再起動復元・streaming提案生成、元15ファイルのSHA-256不変を確認。
試験用cloneを移動すると失効表示となり、再起動後Systemへ復帰。移動先の再登録と生成も成功した。
`external_local`を`detected`で選択できるよう直し、起動直後のhelper `busy`競合だけ限定再試行する。
最終sourceの隔離プレビューで3,600字のstreaming生成を停止し、本文不変更を画面で確認。
Apple Intelligenceへ切替→E4Bに戻した後の再生成もDiff提案まで完了した。
別の3,600字生成中はモデル選択が無効、停止後に復帰。Rustの生成予約中選択拒否テストも再実行して通過。
通常macOS権限のCore AI helper単体は実E4B v2のnon-streaming校正候補を返した。
frontend 2702件、scripts 31件、型検査、Vite、App Store surface 132件は通過。
clean source `df33a65a`からbuild 151署名pkgを作成し、app / extension番号一致と署名・digestを確認。
App Store Connectへのuploadはオーナー承認待ち。外部bookmark付きnon-streaming IPC、実外部ディスク
切断、TestFlightのproduction profile / App Group / Background Assetsはなお未受入。
通常生成IPCのhelper待機をTauriのblocking workerへ移した。Rust全体473件pass / 3 ignored、
最終調整後の関連80件pass、`npm run build`と元bundle IDの1280×820起動smokeが成功。
build 151にはこの変更が入らず、配布候補から外した。
clean source `76d38284`からbuild 152署名pkgを作成し、app / extension番号一致、pkg署名・
digestを通常macOS権限で確認した。build 151は旧候補。後続で選択済みCore AI行に
固定短文の通常生成試用を追加し、request IDでの取消・画面終了、応答model ID照合、
モデル切替後の古い結果消去を実装した。frontend 2708件、scripts 31件、Rust 477件pass /
3 ignored、App Store surface 132件、型検査、Vite build、Rust fmt、600px fixture表示を確認。
build 152はこの導線を含まない。Apple送信・TestFlight installは未実施。
このsourceの`npm run build`で作った元bundle IDのプレビュー`.app`も起動し、
macOSの1153×739表示窓を確認した。実モデル生成の証拠ではない。

- **`npm run build`起動クラッシュ修正（2026-09-23）:** 旧ad-hocプレビューは起動時refreshで
  `BAAssetPackManager.sharedManager`へ入り`SIGTRAP`。別IDコピーでも再現し、extensionとの
  build番号一致でも解消しなかった。preview専用transportがApple-hosted取得を利用不可として返し、
  画面ではTestFlight案内を表示。submitコマンドにはpreview flagを付けない。
  修正後`npm run build`と別IDコピーの1280×820起動smokeが成功。後続の元bundle ID `.app`も
  `open -n`でウィンドウ表示を確認。frontend 2698件、
  scripts 31件、Rust 473件pass / 3 ignored、surface 132件、distribution probeも成功。
  TestFlight取得・実モデルは未検証。

- **C-3 外部フォルダ / Local Assist導線（2026-09-23、source接続）:** Local Assistの選択メニューから
  モデル管理へ移動可能にした。標準フォルダ選択→Rust local contract検証→read-only bookmark登録、
  再起動時のregistry復元、Rust選択時の再検証、helperがbookmarkを自プロセスで解決してから生成、
  登録解除時の元ファイル保持までつないだ。bookmark失効は失敗行として残す。
  frontend全体・focused、Rust 467件pass / 3 ignored、Swift 66+4件、型検査、Vite、
  App Store surface 132件、配布用helper buildが通った。bookmark実登録の無署名テストは
  制限付き実行環境の`Operation not permitted`で失敗し、製品不具合とは判定しない。
  App Store sandboxプレビューの署名smokeにCore AI helperを追加し、3 helperのinherit entitlementと
  親アプリのad-hoc署名を確認。後続の隔離ad-hoc sandbox実操作では外部E4Bの読取・
  streaming生成・再起動復元まで進んだ（冒頭）。**配布署名済みTestFlightでの外部bookmark付き
  non-streaming生成、取消・切替、VoiceOverは未受入。** 次は同一配布候補で確認し、Custom ModelsのFinder導線を整える。

- **pack更新 / モデル設定（2026-09-23、source検証済み）:** build 147で12B pack v2が旧manifest
  全文一致に失敗したとの実機報告。Rustはpack内manifestの固定identity / runtime契約、safe path、
  size / SHA-256を検証し、同じasset pack IDの互換更新を許す。Background Assetsの最新版取得完了まで
  旧版pathを検証しない。E4B v2はsourceでDL対象にした。設定は現在モデル、状態、容量、復旧操作を
  優先し、内部エラーと取得対象版を詳細へ移した。選択中モデルの更新後はhelperのpathも新版へ切り替え、
  生成中は切り替えまで監視する。Rust 465件pass / 2 ignored、frontend全体、App Store surface、
  Viteとnative bridgeコンパイル、fixture表示を確認。新app buildの実機・TestFlight・
  VoiceOverは別途受入が必要。build 147は遡って修正されない。

- **Core AI参考文脈probe（2026-09-23）:** 同じ短い校正対象で文脈だけ変えると、
  E4B v2 / 12Bとも参考文脈内の「青い栞を赤い栞に変更」という命令を生出力へ取り込んだ。
  事実だけの参考文脈では保持。12Bは複合文脈でも再現、E4Bは命令単独時に再現。
  8,000字文脈は両モデルで生成エラー。校正9件の文脈なし/ありA/BはE4B v2・12B・Systemで
  各9組の候補が一致、保持チェック全通過。初回校正の文脈を省き、追加依頼では固定原文/履歴だけ維持。
  他操作の文脈/実原稿/実機品質は未受入。[詳細](reviews/2026-09-23-core-ai-context-probe/README.md)。

- **Core AI直接会話（2026-09-23）:** E4B v2と12Bを編集prompt/formatterなしでmacOS
  `LanguageModelSession`へ渡し、同じ日本語4ターンで短い会話と合言葉の記憶を確認。
  Apple標準`llm-runner`でも12Bはpipelined/warmup offで一問に回答した。
  [直接会話の証跡](reviews/2026-09-23-core-ai-direct-chat/README.md)。これは編集品質や
  TestFlight受入ではない。現行build 146のアプリ本体は旧E4B v1 IDのまま。オーナーは
  v2のTestFlight配信成功を報告したが、この作業ではApple側を独立確認していない。
  v2 catalogはsourceで`not_published`。
  新しいアプリbuildの前にApple処理と配布判断を確認する。

- **E4B v2（2026-09-23）:** v1 static PLE graphでの日本語崩れを切り分け、固定QAT checkpointから
  per-token PLE provider版を再変換。元重み、テーブル、decoder、runtime patchをpinした。
  PLEテーブルは元checkpointから再生成して3ファイルともSHA一致。実helperの6例×3回＋取消後は成功。
  新IDの`.aar`はローカル作成済みで、Rust catalogは`not_published`。
  16 GB実機memory/品質、AOT、v2を参照する新アプリbuildでの取得・生成は未受入。
  [外部レビュー資料](reviews/2026-09-23-core-ai-e4b-v2/README.md)から再開する。

- **実機フィードバック（2026-09-22）:** Local Assistの文字を一段縮小し、再確認ボタンを撤去。
  モデル選択時の自動probeを上部で短く示す。同一選択でも再probe、失敗理由・入力とのaria関連は維持。
  UIテストとブラウザー表示は確認済み。E4Bは固定18件が以前のraw / candidateと完全一致したが、
  日本語崩れは残る。15/18の機械チェック成功を品質合格と読まない。
  次はユーザー再現例・旧版の固定と、生成tokenの逐次 / 全体decode、promptの隔離比較。
  [証跡](reviews/2026-09-22-assist-device-feedback/README.md)。ad-hoc previewは再ビルド・probe成功。
  build 146の署名pkgへ今回UIは未反映。

- **審査・掲載文は準備済み草案（2026-09-22）:** [3.1掲載文パケット](releases/3.1.0-app-store-listing-copy.md)が入口。
  日英What's New、英語審査メモ、説明・副題・Keywords、画像案と未受入ゲートを整理。
  Connectへの保存・送信は未実施。署名pkgは`8dffa835`から作成済み（候補詳細はignoredのlatest.json）。
  次はオーナー実機受入と出荷範囲決定。配信未受入のCore AI追記を自動で掲載しない。

- **モデル設定は実機レビュー待ち（2026-09-22）:** local選択を設定・Assist pickerで統一。
  local消失時のSystem復帰、設定で「使う」が消えた後のfocusを修正。再レビューの通常テーマfocus枠と
  消失localの3言語表示も修正。frontend 2,686件、scripts 24件、surface 132件、型検査、
  App Store preview build / distribution probeはローカルで成功。CIの独立確認ではない。ローカルad-hoc previewは
  3.1.0。次はオーナーが実操作・VoiceOver・実モデルmemoryを確認する。
  [範囲と手順](reviews/2026-09-22-model-settings-self-review/README.md)。sandbox / TestFlightは別ゲート。

- **C-3 再レビュー追加是正（2026-09-22）:** 前回4件のクローズ確認後に見つかったP2/P3を
  `a7d19487` で閉じた。署名不一致・取得不能ではreplacement factory前に旧cache entryを解放し、
  同一署名だけを再利用する。replacement失敗後も旧entryを保持しないことをダミーmodelで固定した。
  `embedded_tokenizer` は省略時のみtrueを既定にし、明示`null` / 型不正をRust / Swift共通の
  `malformed-bundle-metadata`とした。共有fixtureは35ケース。frontend 2,677件、scripts 24件、
  Rust 456件（2 ignored）、Swift XCTest 61件 + Swift Testing 4件、surface 132件、型検査、Vite、
  production distribution helper build、Rust fmt、diff checkは成功。実local modelのmemory / swap、
  load / 生成、built app、VoiceOver、TestFlightは未確認。次は同じ資料で外部再レビューする。
  [外部再レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)。

- **C-3 複数スライス外部レビュー是正（2026-09-22）:** `2fd9df12` でloader metadataを
  local contractへ取り込み、`assets.main` を検証済み単一 `.aimodel` と完全一致させた。
  `../` / 途中symlink / 別model参照を拒否し、`embedded_tokenizer=false` はloader生成前に
  `external-tokenizer-not-allowed` とする。cache identityはbundle / `.aimodel` metadata、
  Tokenizer補助設定とその非存在を含み、大きなpayloadは秒未満mtime + file identityを見る。
  layoutの欠落 / 空文字codeもRust / Swiftで統一し、共有fixtureは31ケース。frontend 2,677件、
  scripts 24件、Rust 456件（2 ignored）、Swift 61件、surface 132件、型検査、Vite、production
  distribution helper build、Rust fmt、diff checkは成功。実local model / built app / VoiceOver /
  TestFlightは未確認。次は同じ資料で外部再レビューし、bookmark / helper権限境界へ進む前に閉じる。
  [外部再レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)。

- **C-3 app-managed local backend 接続（2026-09-22）:** スライス3として、検証済み
  `CoreAICustomModels` 候補を Rust-owned selection、再起動復元、availability、通常 / streaming
  生成へ接続した。Rust は ID から path を復元せず毎回 scan 結果へ照合し、helper は
  `core_ai_local` を受けて `CoreAILocalResourceContract` を再検証してから `CoreAIKit` へ渡す。
  local model は production prompt / generation profile を使い、Apple-hosted の signed contract と
  asset lifecycle は変更しない。保存候補が消失・破損した再起動では System へ戻して保存値も修復する。
  frontend 2,676件、scripts 24件、Rust 456件（2 ignored）、Swift 59件、surface 132件、型検査、
  Vite / production distribution helper build、Rust fmt、diff check は成功。実 local model の load / 生成、
  built app、VoiceOver、TestFlight は未確認。外部 resource folder / bookmark は次スライス。
  [スライス1〜3 外部レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)。

- **C-3 Custom Models registry / UI 統合（2026-09-22）:** スライス2として
  `app_data_dir()/CoreAICustomModels` の候補を既存 `CoreAiModelStore` とモデル管理ページへ接続した。
  summary の `source` / `errorCode` と `detected` 状態で、正常候補は「ローカル・検出済み」、
  壊れた候補はローカライズした contract 理由を表示する。ローカル候補は検出・表示のみで、
  frontend に Apple-hosted 用操作を出さず Rust 側でも select / download / cancel / delete を拒否する。
  frontend 2,676件、scripts 24件、Rust 455件（2 ignored）、surface 132件、型検査、Vite build、
  Rust fmt は成功。この時点では helper のローカル backend、選択・生成、外部 bookmark、フォルダ操作
  UI は未接続だった。選択・生成は後続スライス3で接続済み（先頭項目）。
  [証跡](reviews/2026-09-22-v3.1-c3-custom-model-catalog/README.md)。

- **C-3 外部レビュー是正（2026-09-22）:** スライス1の「Rust は helper と同じ契約」という主張を
  訂正した。production helper は licence / notice / `expectedModelId` 一致を要求し、bare
  language bundle も受理しないため、production 契約へ寄せず**ローカル契約を分離**した。Swift に
  `CoreAILocalResourceContract` を追加し、`src-tauri/resources/core-ai/local-model-contract-cases.json`
  を共通 fixture spec として Rust（`include_str!`）と Swift（`#filePath` 探索）の両テストが
  同じ20ケースを通す。symlink は root 配下の全 component で拒否し、Custom Models scan は
  symlink / 種別不明の候補も `unsafe-path` / `unreadable` として報告する。descriptor の read 失敗と
  JSON parse 失敗も分離した。検証は `cargo test`（452 passed / 2 ignored、モジュール内25件）と
  `swift test`（57 passed、新規5件）。Swift は sandbox 外で実行した。**helper のローカル backend
  経路、security-scoped bookmark、Custom Models の保存場所は未接続**。
  [証跡](reviews/2026-09-22-v3.1-c3-local-contract-followup/README.md)。

- **C-3 ローカルモデル解決・検証層（2026-09-22）:** v3.1 追加レーンの1本目。Rust へ
  `core_ai_local_models.rs` を追加し、resource root / language bundle / `*.aimodel` 指定から
  canonical な `ResolvedLocalModel` を返す。`metadata.json`、`tokenizer/tokenizer.json`、
  単一 `*.aimodel`（`metadata.json`/`main.hash`/`main.mlirb`）を必須にし、`hazakura-model.json`
  があれば `schemaVersion`/`modelId`/`runtimeKind`/`layout` を読む。`gemma4-ple` は tables も必須。
  symlink、bundle 外 `layout`、`..`、tokenizer/tables 欠落、`.aimodel` 重複を安全側で拒否し、
  `scan_custom_models_directory` は壊れた候補も理由付きで返す。`cargo fmt --check`、
  `cargo test`（447 passed / 2 ignored、新規20件）は成功。この時点では catalog / IPC / UI と
  保存場所が未接続だったが、後続スライス2で app-managed の保存場所と検出表示、スライス3で
  選択・helper 経路まで接続した。外部 resource folder の security-scoped bookmark と helper への
  sandbox 権限受け渡しは引き続き未接続。
  [証跡](reviews/2026-09-22-v3.1-c3-local-model-resolution/README.md)。

- **外部レビューP2 6件の追補（2026-09-22）:** streaming最終候補を最後のraw snapshotから作り、
  model catalogの購読/snapshot/操作応答を2画面で共通化した。Background Assetsはserial queueと
  操作世代で解決中cancelを止め、paused monitorを5秒間隔で維持する。削除失敗は旧選択を復元し、
  pickerは進捗更新でfocusを奪わない。設定のSystem状態、サイズ、削除確認、折りたたみも整理した。
  frontend 2,674件、scripts 24件、Rust 427件（2 ignored）、Swift 52件、surface 132件、Vite /
  App Store preview buildは成功。実装commit `a16b0971`のPR #52 Quality run `35664620124`も
  frontend / nativeとも成功し、merge stateは`CLEAN`。次は外部再レビューを取り、その後に
  built app / VoiceOver / sleep-wake / 実Background Assets / 32 GB機TestFlightを確認する。
  [証跡](reviews/2026-09-22-testflight-review-followup/README.md)。

- **Core AI 12B + モデル管理仕上げ（2026-09-22）:** App Store固定catalogへ12Bを追加し、
  E4Bと同じApple-hosted download / G2検証 / 選択 / 削除経路へ接続した。設定はdownload量、
  展開後使用量、推奨メモリ、license要約を表示し、Rustが読む物理メモリが推奨値未満なら開始前に
  確認する。状態購読はsnapshotより先に登録し、取得中のeventを古いsnapshotで巻き戻さない。
  12Bの完全な外側prompt envelopeだけを除去し、本文中markerは維持する。実12B評価は変更前
  14/18の`noInternalMarkers`失敗から変更後18/18全check通過。ローカルarchiveは
  9,148,924,300 bytesで、固定SHA-256は外部レビュー用証跡へ分離した。
  frontend 2,666件、scripts 24件、Rust 424件（2 ignored）、Swift 49件、surface 131件、
  App Store preview buildは成功。12BのApple upload / processing、32 GB機TestFlight、
  built appの設定画面、VoiceOverは未確認。[証跡](reviews/2026-09-22-core-ai-12b-catalog/README.md)。

- **PR #52 native CI修正（2026-09-22）:** macOS 27専用Background Assets selectorをSDK compile
  guardへ入れ、macOS 26 SDKではunsupported fallbackだけをコンパイルする。Quality run
  `35655597653`はfrontend / nativeともに成功し、PRのmerge stateも`CLEAN`を確認した。
  外部レビューを通すまでmergeしない。

- **PR #52 の旧CI失敗（2026-09-21、修正・再実行済み）:** `frontend` jobは緑、`native`は
  macOS 27専用Background Assets selectorを`runs-on: macos-26`でコンパイルして失敗していた。
  2026-09-22にSDK compile guardを追加し、macOS 26 runnerのnative job成功で閉じた。
  [元の詳細](reviews/2026-09-21-review-followup-models-page/README.md)。

- **外部レビュー2巡目（2026-09-21）:** `540affc7` への P2/P3 を閉じた。ページ見出し
  （`tabIndex={-1}`）へ着地した後の Tab がヘッダーへ戻っていた問題は、フォーカストラップで
  「ダイアログ内の受け皿」と「ダイアログ外へ抜けた」を区別し、受け皿の DOM 位置から前後へ
  進めるようにした（端の折り返しは不変）。かなメニューの「おんでばいますもでる...」も訂正。
  回帰テストは unit に加え、実 `PreferencesDialog` + `useModalKeyboardGuard` の組み合わせで
  「着地→Tab」「着地→Shift+Tab」まで見る。旧挙動へ戻すと2件落ちることを確認（red → green）。
  Rust 424件（2 ignored）、frontend 298 files / 2,662件、project script 24件、型検査、
  Vite build は成功。
  **マージ手順の注意:** `gh pr merge --match-head-commit` は HEAD 一致のガードであり
  fast-forward 指定ではない。SHA を保つ厳密な FF-only はローカル `git merge --ff-only` →
  `main` push で行う。built app のフォーカス実機確認は未実施。
  [証跡](reviews/2026-09-21-review-followup-models-page/README.md)。

- **外部レビュー追補（2026-09-21）:** モデルページの P2 2件を閉じた。遷移後の
  フォーカスは見出しへ移し（ヘッダー選択から来たときは選択を維持）、生成設定は
  「購読 → スナップショット」にして取得中に通知が来たら取得結果を捨てる。
  あわせて `MENU_ON_DEVICE_MODELS` を追加し、**システムメニューから設定本文を経由せず
  モデルページを直接開ける**ようにした（macOS はアプリメニュー、他 OS は File）。
  Rust 424件（2 ignored）、frontend 297 files / 2,659件、project script 24件、
  surface 130件、型検査、Vite build、App Store preview の `npm run build` は成功。
  両修正とも外すと新規テストが落ちることを確認（red → green）。
  **CI はこのブランチでは走らない**（`quality.yml` は PR と `main` push のみ）。
  built app のメニュー実表示・フォーカス、VoiceOver、最大 Dynamic Type は未実施。
  [証跡](reviews/2026-09-21-review-followup-models-page/README.md)。

- **オンデバイスモデルを独立ページにする（2026-09-21）:** Preferences ダイアログに
  `models` ページを追加し、モデル一覧（状態・サイズ・資産バージョン・開始/進捗/再開/取消/
  削除/選択）、保存先の説明、直近の生成記録、境界の説明を1ページへまとめた。
  設定本文には入口の1行だけを残す。保存先は選ばせず説明のみ、自動ダウンロードと
  起動時スキャンは不変。変更は frontend / CSS / docs のみで Rust 契約は不変。
  frontend 297 files / 2,654件、project script 24件、App Store surface 130件、型検査、
  Vite build、Vite fixture の実表示（日本語 light / 英語 dark / 未配布の空状態）は成功。
  **built app の表示・VoiceOver・最大 Dynamic Type は未実施**。2026-09-22にlicense要約と
  展開後使用量を追加済み（notice本文を開くUIは未実装）。
  [証跡](reviews/2026-09-21-on-device-models-page/README.md)。

- **Core AI 生成設定の可視化（2026-09-21）:** helper が返す `usage`（要求/実効の
  サンプリング、出力上限、トークン数）を Rust が保持し、設定のオンデバイスモデル欄へ
  「直近の生成記録」として出す。表示は webview 側の写しではなく Rust の記録だけを
  読む。未観測時の空状態あり、記録はプロセス内のみ。モデルへ渡す内容は不変。
  Rust 422件（2 ignored）、frontend 2,649件、project script 24件、surface 129件、型検査、
  Vite build、App Store preview の `npm run build` は成功。**実 Core AI での観測と
  built app の表示確認は未実施**。
  [証跡](reviews/2026-09-21-core-ai-generation-profile/README.md)。

- **Core AI E4B配線の作り込み（2026-09-21）:** 追加要望があると action 別の基本指示が
  落ちていた点を直し、要求した生成設定とエンジンへ渡った実効設定を usage に分けて記録し、
  停止トークンの外側除去とロード済みモデルの再利用（アイドルで解放）を入れた。System 経路も
  同じ `AssistPrompt.buildLive` 契約。評価ハーネスへ `noControlTokens` と追加指示なし fixture を追加。
  Swift 37件 / distribution `swift build` / frontend / Rust は成功。**E4B の実生成による
  再測定は未実施**（Codex 環境は GPU を渡さず `CoreAIKit.KitGemmaError.noMetalDevice`）。
  オーナー shell で `node scripts/evaluate-local-assist.mjs --backend core_ai ...` を回し、
  ロード時間と最初のトークンまでを分けて記録する。
  [調査メモ](core-ai-harness-quality.md) / [current-work](current-work.md)。

- **Core AI配布前基盤（2026-09-20）:** App Store / TestFlightレーンへCore AI production
  adapterをmacOS 27+専用の別helperとして同梱し、設定のモデル管理とLocal Assistの選択、
  Rust-owned選択状態を接続した。System helperはmacOS 26互換を維持。2026-09-21からApp Store
  catalogへE4Bを接続し、2026-09-22に12Bも追加した。Apple-hosted downloader extension、App Group、`BA*` keys、
  `AssetPackManager`、進捗・取消・再開・削除・再起動復元、G1/G2をsource実装した。
  Apple-hosted asset pack upload、AOT、notice最終確認、署名候補/TestFlight実機受入は未完了。Developer固定Qwenを配布catalogへ
  入れず、任意URL/path/GGUFと自動fallbackも足さない。
  最終のSwift 24、Rust 417（2 ignored）、frontend 2,646、project script 14、surface 129、
  `npm run build`とlocal preview probeは成功。
  [記録](reviews/2026-09-20-core-ai-distribution-preflight/README.md)。
  レビューP2追補: 起動選択を一本化し、Developer明示指定を優先・永続化せず、App Storeは無視。
  モデル管理初期化の失敗は`managementError`として設定に表示し通常起動を妨げない。
  切替保存失敗のruntime不一致と再probe中の旧availabilityも修正。
  再レビューR1 / R2: probeはworker上で実行し、生成予約・占有中は即時busy。問い合わせと
  返却model IDを同一snapshotへ固定。通知購読は言語から独立し、最新文言をref経由で読む。
  「再確認」は会話を保持し、切替・確認中は重複操作と送信を止める。
  最終Rust 417（2 ignored）、frontend 2,646、surface 129件、build / preview probeは成功。
  native遅延helperテストは成功、遅延中の実ウィンドウ操作は隔離QAで導線へ到達できず未確認。
  再生成されたmacOS用の本体・extension profileと署名identityは検証済み。3.1.0 build 143の
  Apple Distribution署名appとInstaller署名pkg、entitlement probe、deep verify、installer chainを
  通した。E4B `.aar`はsandbox外の`npm run coreai:models:package`で生成済み。ただしbuild 143は
  extension署名に`com.apple.application-identifier`が無いとしてApple 90886でTestFlight不適格に
  なったため、署名scriptはprofileからapplication/team identifierを導出してextensionへ署名し、
  署名後に読み返して検証するよう修正した。同一build番号は再uploadできないので差し替えcandidateを
  作り直し済み。build 144はAppleの処理まで通り90886の修正を実証、asset pack ID変更後の
  差し替え候補は3.1.0 build 145（未upload）。asset/buildをuploadしてInternal TestFlightの
  CDN→検証→helper loadを実機で受け入れる。
  `.aar`のTransporter uploadはApp Store Connect側の`-19243`/400 invalid valuesで止まっており、
  `altool`で実APIを叩いたところ、原因はasset pack IDのピリオドだった（App Store Connectは
  `assetPackIdentifier`内の`.`を拒否する）。E4B/12BのIDを`hazakura-coreai-gemma4-e4b-v1` /
  `hazakura-coreai-gemma4-12b-v1`へ変更し、`.aar`を再生成した。次の一手は新IDの`.aar` upload。
  2026-09-20にGemma 4 E4Bを標準候補、Gemma 4 12Bを高品質比較候補としてidentityを固定。
  `scripts/core-ai-production-models.json`へ変換物revisionとfile digestをlockし、
  `scripts/prepare-core-ai-model-assets.mjs`で取得・検証・resource manifest・Apple-hosted `.aar`を
  再生成できる。以前は現ホストのXcode 27.0 `ba-package`を拡張子判定不具合と判定したが誤りで、
  失敗はCodexのseatbelt sandbox内だけで再現する。通常shellでは全CLI形式が成功し、manifestも
  実物の`ba-package template`と照合して有効。`package`は`sourceRoot`へchdirしてから出力pathを
  解決するため絶対pathを渡すよう修正し、sandbox外でE4B / 12Bの`.aar`を生成済み。product helperは分離した
  `CoreAIProduction.Package.resolved`のCoreAIKit runtimeで
  E4B PLE / 12B bundleをロードする。詳細は[本番候補準備](core-ai-production-models.md)。
  現ホストは`coreai-build`なしのためAOTも未完了。最初のmobile profileはpreflightで拒否したが、
  再生成profileと署名identityは上記candidateで受入済み。App Store Connect asset/app upload、
  processing、TestFlight実機受入、license最終確認が残る。
  [2026-09-21 handoff](reviews/2026-09-21-core-ai-apple-hosted-e4b/README.md)を正本にする。
  E4Bと12BはM4 Max / 128 GBのホストでproduction helperのloadと短い日本語校正まで成功。
  E4Bは7,376 ms、12Bは8,872 ms。これは16 GB / 32 GB機の性能、正式bake-off、署名app、
  TestFlight/CDN受入の証跡ではない。

## Current State

- **3.1.0開発版へ移行（2026-09-20）:** npm / Tauri / Cargo / lockfileの版面を更新し、
  [App Storeリリースノート草案](releases/3.1.0-app-store-release-notes.md)を開始した。
  まだ署名候補・TestFlight・申請・タグ・公開ではない。Core AI本番接続、Connect設定、
  公開Web、英語UIの署名候補受入後に掲載文を確定する。並行するbundleVersion変更は候補証跡にしない。

- **Core AI Phase 1（2026-09-20）:** Developer専用の固定Qwen3-0.6BをCore AIでロードし、
  既存Local Assistのstream / Proposal / Diff / 明示Apply / Undo / Cancelへ接続した。
  backendと固定pathの正本はRust。frontendへ任意path / URL / importは露出せず、失敗時のSystem fallbackもない。
  専用QA appでCore AI実フローと `system_default` 復帰を確認。実生成元をUIにも表示する。
  Qwen品質は不合格。本番C-1配布・digest・削除、本番identity、App Store同梱は次スライス以降。
  [検証記録](reviews/2026-09-20-core-ai-phase1/README.md)。

- **Local Assist表示整理（2026-09-20）:** 対象要約・依頼チップ・一体化した入力欄へ整理し、
  説明の重複を減らした。送信横にSystem 1件でも開けるモデル選択枠を追加。
  フロント全2,620テストと最小サイズのブラウザーfixtureを確認。通常利用者向け切替は未接続。
  [表示・検証記録](reviews/2026-09-20-local-assist-polish/README.md)。次はnative窓の操作・IME・VoiceOver確認。

- **俯瞰レビュー追補:** H31-01/H31-02は修正・回帰テスト済み。
  [検証記録](reviews/2026-09-20-v3.1-overview-followup/README.md)を参照。
  [Core AIテストモデル](core-ai-test-model.md)を単体生成まで確認したが校正品質は不合格。
  次は画像ブロックの英語復旧案内とbuilt appの状態別受入。Core AI本番C-1/C-2は別スライス。

- **v3.1開始（2026-09-19）:** Core AI実利用と海外App Store展開の二本立て。
  `docs/international-launch/` のI-0ソース／静的棚卸しを入口にし、Connect上の地域・価格・
  契約、公開Web、署名候補の英語受け入れは未完了として分離する。Core AI本番C-1/C-2は
  identity等のゲート待ち。I-0aでメイン窓／Local Assist窓のHTML `lang`を表示言語へ同期し、
  `kana`は `ja`として扱うことをテストで固定した。外部レビューのP2・P3も同じスライスで閉じ、
  ルートの同期はUI chrome用として、本文を描く面は「言語不明」でUI言語を継承させず、
  本文へ差し込むアプリ文言（画像ブロックの案内は `ja`、ページ区切り・テーブル枠・
  L Modeタスクのラベルは `en`）は、それぞれ実際の言語を宣言する。
  メイン窓・Local Assist窓はReact初回描画の前にも保存値を反映するが、Agent窓は
  chromeが英語固定なので `en` のまま。外部再レビューのテーブル枠P2は、子 `table` を
  `lang=""` へ戻し、raw HTMLの明示言語を保持して閉じた。I-0bで主要導線の英語copyを
  静的に棚卸しし、英語UIでも日本語を主表示していた致命的フロントエラー復旧面を
  英語／日本語へ分離した。外部レビューのfalsy throw値P2も、エラー発生状態をcatch値から
  分離して閉じ、再レビューはP0 / P1 / P2 / P3なし。Quality run `#35466308356` も成功。
  次はbuilt appの英語実表示。bundleの英語・日本語宣言は
  署名候補確認後まで保留し、翻訳範囲や公開状態を越えて主張しない。

- **v3.0.3を実機確認して申請（2026-09-18）:** 編集面のスクロールバー不具合 3 件を直した不具合修正版。
  (1) 右ペインのリサイザ `.pane-resizer::before` の透明な当たり判定が本文の右端へ 4px 食い込み、
  本文右端でつかむとスクロールの代わりにペイン幅変更が始まっていた（張り出しを右だけに限定）。
  (2) 一気に最下部まで引くと末尾より少し上で止まっていた（編集→プレビューの同期ガードが
  固定 80ms でドラッグ中に切れ、古い比率が本文を書き戻す＋行高さの再計測で総高さが伸びる。
  ガードを自己延長 150ms に揃え、トラック下端で終わったドラッグだけ底へ寄せ直す）。
  (3) スクロールバーを離してフォーカスが戻るときにエンジン / CodeMirror が位置を書き換え、
  画面がキャレットの行へ引き戻されることがあった（ドラッグ位置を 1 フレームだけ取り戻す）。
  同種の当たり判定は fixture で到達できる主要面について総当たり検査し、他に該当なし
  （`reviews/2026-09-17-scrollbar-drag/README.md`）。版数は npm / Tauri / Cargo /
  package-lock を `3.0.3` へ。提出文案は
  [3.0.3 App Store notes](releases/3.0.3-app-store-release-notes.md)。
  オーナーが実機（WKWebView）で確認し問題なしと報告、その報告で申請する。
  署名 pkg は build 140。ローカル候補記録（`docs/internal/app-store-candidates/latest.json`）は
  2.9.0 / build 125 のままで未更新。

- **v3.0.2を提出用に準備（2026-09-16）:** 公開済み3.0系で残っていたmacOSメニューバーの明滅を直した不具合修正版。
  本文更新ごとの `set_title` IPC と、フラグ変化ごとの `app.set_menu` 全再構築を止め、メニュー状態は
  「同一state→何もしない / フラグのみ→差分適用 / ラベルか項目集合→再構築」にした。App Store lane で
  in-place が失敗して再構築へ戻る問題、モーダル中のテーマ／チェック項目でネイティブ表示だけが変わる問題も塞いだ。
  版数は npm / Tauri / Cargo / package-lock を `3.0.2` へ。提出文案は
  [3.0.2 App Store notes](releases/3.0.2-app-store-release-notes.md)、作業記録は [current-work](current-work.md)。

- **v3.0.0公開済み（2026-09-14）:** オーナーが公開を報告。Mac App Storeの製品ページでバージョン3.0.0を確認。
  公開build/sourceの対応・build番号・TestFlight個別受入は独立未確認。未コミットで残っていたv3最終調整は
  区切りごとにコミット済み。GitHubソースタグ `v3.0.0`＋Release（ソースのみ）を作成。README・公開画像をv3へ更新、
  既定ブランチ `main` もv3.0.0へ同期。
  [公開記録](releases/3.0.0-source-tag.release.md)。

- **編集クロームを整理（2026-09-13）:** 全テーマでタブの上下線を静かな選択面に置換。えるモード左の空列、下段の重複パンくず、表示操作の選択下線を整理。上部ボタンの文字選択も抑止。
  QA実機7テーマ・5タブ・狭幅・Aa/えるモード往復を確認。Local Assistラベルはブラウザfixtureで検証（QA設定では入口非表示）。
  全2,498件、型検査/Vite、surface125件成功。[画像と検証範囲](reviews/2026-09-13-editor-chrome/README.md)。提出候補の更新は別。

- **「読む」の見開き・文字サイズを調整（2026-09-13）:** 既定1280×820で可変幅の見開き、中央52pxの余白、
  上部に文字サイズ12〜24（既存プレビュー設定と共通）を追加。端数のページ計測と現在章の目次再選択による送り停止も修正。
  QA実機で標準/狭幅・文字拡大・再入場・本文未変更を確認。全2,498件、型検査/Vite、surface125件成功。
  [変更と実機画像](reviews/2026-09-13-reader-layout/README.md)。提出候補・全体受入は別。

- **「確認」の往復とスクロールを修正（2026-09-13）:** 差分への入力を遮る空の editor host を隠し、
  「書く」で比較を終了。WebKit の blur で選択クリックが失われる問題も修正。
  QA実機で末尾スクロール・上部のみ3往復・追加編集の再比較・Undoを確認。全2,495件、型検査/Vite、surface125件成功。
  [再現・原因・検証範囲](reviews/2026-09-13-review-navigation-fix/README.md)。提出候補とv3全体受入は別。

- **v3の空気感を実機で調整（2026-09-13）:** 設定/ヘルプの案内を集約し、検索の行間・読書見出し・復旧/衝突の紙色を整理。
  文書領域960px以下は既存の一面切替へ。目次なしの一章文書が細い列に入る不具合も修正。
  分離したQAアプリで実表示・検索/読書/比較導線・狭幅復帰を確認。全2,492件、型検査/Vite、surface125件成功。
  v3全体の受入とは分ける。[変更・実機の前後画像・残確認](reviews/2026-09-13-v3-atmosphere-polish/README.md)。

- **v3の空気感レビュー（2026-09-13・提案のみ）:** 24モックを確認し、現行21項目の関連表示（部品・空状態を含む）を撮影。
  設定/ヘルプ、復旧/衝突の面色、検索の密度、読書の組版を調整候補に整理。狭幅の分割は判断待ち。
  機能コード未変更。Import Assist・生成中・生成失敗は実表示未判定。[比較レポートと確認範囲](reviews/2026-09-13-v3-atmosphere-audit/README.md)。

- **次はv3実機受入:** 最新UI/江戸彼岸を含む提出文案へ更新。未コミット修正の確定→候補再作成→同じbuildの
  保存/復旧・IME・Assist生成/停止/Apply/Undo・書き出し現物を確認する。候補管理の最新記録は旧版のまま。
  [候補の現状と限界](releases/3.0.0-source-tag.release.md)。27固有API/品質評価は未検証として維持。

- **江戸彼岸:** 全面WebGLの葉影/起動演出を `EdohiganAmbient` の枝花とCSS花びらへ置換。
  明色トークンは維持、Previewのリンク/コードとReaderの旧暗色指定は解消。全2,486件・型検査/Vite・surface125件成功。
  次はnativeで演出強度・動きを減らす設定・入力中の落ち着きを確認する。混在する既存UI/App Store設定差分を保持。
  [前後比較・素材由来・残確認](reviews/2026-09-12-v3-edohigan-refinement/README.md)。

- **Local Assist 分離窓の江戸彼岸色を修正（2026-09-12）:** 暗色時代の固定背景色の残骸で本文が沈む不整合
  （実測 1.28:1→10.44）を `--bg` へ戻して修正し、全7テーマの窓面コントラスト契約（4.5:1）を追加。
  全2,487件成功。[前後画像と再現](reviews/2026-09-12-v3-assist-window-theme/README.md)。native目視は次の実機ラウンドに合流。

- **Local Assist v3基盤（LA-1a）:** Systemの利用可否（四態wire、不変）と生成能力（locale）を
  `AssistRuntimeContract` で分離し、ゲートの能力失敗を `unsupported_language` へ（文言不変）。
  swift test 16件・live/fixtureビルド・実機live生成・cargo 385件を確認。27環境での照合と評価（LA-1b）は未実施。
  [記録](reviews/2026-09-12-v3-la1-availability-capability/README.md)。

- **直近のv3 UI調整:** 新規作成直後の入力、読書面から本文の表示復帰後に位置・フォーカスを戻す処理、
  検索語変更時の先頭選択、形式切替をまたぐ書き出し元への復帰を修正。全2,479件/型検査/Vite/surface125件成功。
  [再現・画像・次の実機確認](reviews/2026-09-12-v3-final-ux/README.md)。既存App Store設定差分は保持、native候補は未再作成。
  追加のCSS調整は書き出しの紙色・余白共有、文字見本の列揃え、設定外枠のclip。
  [比較画像・再現条件](reviews/2026-09-12-v3-design-polish/README.md)を参照し、nativeでタイトル固定とテーマを受け入れる。

- **v2.9公開済み:** 2026-09-09、オーナーが審査通過・公開を報告。公開build/source対応、
  TestFlightや個別のIME・VoiceOver・旧OS試験結果は今回独立確認していない。
- **UI-A1:** オーナー提供の再レビューでR1/R2 CLOSED、UI-B進行GO。
- **UI-B / LA-0:** オーナー提供レビューでR3〜R5 CLOSED、LA-0 GO。
- **UI-C1 / C2:** オーナー提供レビューでC1追修正・C2-R1 CLOSED。native通し受入は別途残る。
- **UI-D2b / E1:** Save As通知の追加P2も外部CLOSED。UI-E1 GO。
- **UI-E2/E3・E4a:** オーナー提供の外部レビューでR1〜R3 CLOSED、EPUB/PDF外枠GO。
- **UI-E4b / F1:** オーナー提供の外部レビューで書き出し排他・nativeメニューP2 CLOSED、7テーマGO。
- **UI-F2:** オーナー提供の外部レビューでGO、テーマ説明P3 CLOSED。
- **UI-G1:** Settingsの未probeを非対応と断定するP2-lowを138e0cc3で修正。
  56d80817でHelpの画像通信/明示Apply説明、799f649aで低い有効領域の到達性を調整。
  [最新合評・受入表](reviews/2026-09-10-v3-ui-g1/README.md)。
- **UI-G2:** 未コミットで残っていた設定の左レール化を引き取り、カテゴリの現在地を
  本文スクロールから導出する処理を追加（c937e036のassert補強、1cb1e564）。
  [実装と証跡](reviews/2026-09-10-v3-ui-g2/README.md)。
- **UI-G3:** モックの紙面／ナビ面を意味トークン（`--surface-paper` / `--nav-surface`）として新設し
  全7テーマへ適用。エディタ面を紙面トークンへ統一し、補助文字を全テーマ4.5:1以上に調整。
  [実装と証跡](reviews/2026-09-10-v3-theme-paper/README.md)／[差の棚卸し](v3-mock-gap-inventory.md)。
- **UI-G4:** 開始画面（画面01）を2ペイン化。左＝ナビ面のブランド＋45px明朝コピー＋開始操作、
  右＝紙面の「続きから」一覧（アイコン・名前・補足パス・今日/昨日/9月7日）。履歴0件の案内を追加。
  [実装と証跡](reviews/2026-09-10-v3-ui-g4/README.md)。
- **確認:** ローカル259ファイル・2,248件、型検査・Vite・App Store surfaceが成功。
  1440×850で左右720pxずつ、1024×748で縦積み。Rust無変更・cargo test未実行。
- **UI 段階2:** light/darkへモック配色を反映し、`--chrome-surface` を全7テーマへ新設（chrome＝ツールバー・タブ・ステータス、
  サイドバーは nav のまま）。透明タイトルバー色も追従。実測の面の分離は1.06〜1.13:1、accent面の文字はyakou/crtの不足を修正。
  ローカル259ファイル・2,269件、cargo test 383件が成功。[証跡](reviews/2026-09-10-v3-theme-stage2/README.md)。
- **UI 第二調整:** 罫線の階層を全7テーマで調整（`--border` 紙面比1.54〜1.55、`--border-strong` 2.18〜2.22・差0.63以上）。
  focus（`--accent` outline）3:1以上と `theme-palette.json`＝CSS `--chrome-surface` を自動検査に固定。
  実描画の罫線画素 `#dce2d9`→`#c7d2c5` を同座標で確認。ローカル259ファイル・2,304件が成功。
  [証跡](reviews/2026-09-10-v3-border-hierarchy/README.md)。
- **UI 狭幅23:** ≤1100pxでサイドバーを表示上だけ畳む（保存設定なし・明示選択は幅が変わるまで優先）。
  1440=開く／1024=畳む／トグルで開く／1440復帰を実測。264ファイル・2,326件が成功。
  残差は1024のエディタ564px（container閾値780px）。[証跡](reviews/2026-09-11-v3-compact-sidebar/README.md)。
- **設定の外枠:** モック基準へ（1100×752、左レール200px、パディング23×14、項目min-height40px、アイコンなし）。
  1440×850で1100×752・960×640で912×592を実測。[証跡](reviews/2026-09-10-v3-settings-frame/README.md)。
- **UI focus/境界:** focusリングの薄め9箇所を `--focus-ring` へ（light 2.40→5.85:1、shokou 2.11→4.30:1）、
  `--cm-gutter-border` を全テーマ `var(--border)` へ、タブ下・ステータス上の2境界だけ `--border-strong`（約2.2:1）へ。
  全CSSで `outline` に color-mix を使わないことを自動検査に固定。証跡の日付をJSTへ是正。
  ローカル261ファイル・2,314件、App Store surface 117件が成功。
  [証跡](reviews/2026-09-10-v3-focus-and-boundaries/README.md)。
- **UI 手直し:** サイドバーの「No folder open」二重、ツールバーの「Hazakura Editor」二重、
  プレビュー上端の空白（表示ツールバー行の右半分が98.8%単色）を修正。閲覧系の節を行の右端へ寄せ、
  空状態の案内を一本化。ローカル260ファイル・2,309件、App Store surface 117件が成功。
  [証跡](reviews/2026-09-10-v3-rough-edges/README.md)。
- **次:** 棚卸し§6の残課題8件（A=1024の本文幅の判断、B=書体・行間、C=画像寸法の実機計測、D=Help導線、E=Diff行、F=L Mode既定値、G=native受入、H=CI）。UI-Gは未完了。
- **UI-G残件:** Reader背景sidebarのVoiceOver仮想カーソル確認を継続。
- **Local Assist:** v3.0はSystem共通基盤、v3.1はallowlistモデルのDL・管理・切り替え。
  明示Diff/Apply、Undo、no auto-save、取消mutex境界を維持。内部再編・依存・版数は未変更。
- **作業保全:** App Store設定の既存未コミット変更を保持。公開タグ・アセットは変更しない。

## v3.0候補（TestFlight準備・2026-09-11）

- **版数:** npm / Tauri / Cargo を `3.0.0` へ更新した。オーナー管理の
  `src-tauri/tauri.conf.appstore.json`（build番号）は**触っていない**。
- **内容:** モック24画面へのUI整合（江戸彼岸の明色化、スライスC/D/E、07本文面化、11形式ナビ）と、
  外部レビューの修正（R1〜R5、P1×1・P2×3、受入テストの穴）。
- **検証:** typecheck / 全Vitest **275 files・2,403 tests** / Vite build /
  App Store surface **10 files・117 tests** / Rust fmt・**385 passed・2 ignored**。
- **未実施:** 署名pkgは未作成。Appleへのupload・処理・TestFlight配布・App Review は未実施。
  実機受入（WebGL・native・VoiceOver・IME・T01〜T10）はこれから。
- **判断待ち:** 05 / 12 / 13 / 18 / 03。
  採否は `docs/reviews/2026-09-11-v3-slice-cde-review-request.md` に記録。
- 証跡: [3.0.0候補](releases/3.0.0-source-tag.release.md)。

## v2.9候補時点の記録（2026-09-09公開報告前）

以下は候補準備時点の証跡。配布前の「未実施」「次」は当時の記録であり、現行キューではない。
公開報告から個別試験の合格や公開buildの同一性を補完しない。

- **品質強化完了・実機へ:** 2026-09-09、オーナーが外部再レビュー通過を確認。
  PR #45をmainへマージ（1a97a697）。候補source 190e854dとの製品コード差分はなく、
  再作成せずTestFlightの実機受け入れ確認へ進む。実機合格・Apple送信済みという意味ではない。

- **v2.8公開:** 2026-09-08オーナー報告。公開buildとsourceの対応は過去候補から推定しない。
- **v2.9品質候補:** ソース版数は **2.9.0**。外部の日常利用レビューQ-01–Q-07を修正。
  Save As中の編集、独立した下書き復旧、保存して閉じる、Unicode検索、文字コード再読込、
  workspace操作の部分成功、PDF/HTML画像警告を回帰試験へ固定した。
- **外部再レビュー対応:** N1の空CRLF復旧記録の消失とN2の改行なしSave Asのdirty残りを修正。
  空/一行/複数行×LF/CRLF、取り出し後の永続化/再起動を回帰検証した。
  A1は画像・CSS込みHTMLの10 MiB上限を事前案内する。上限自体は残る。
- **追加の原稿保全:** 10 MiB超の保存を元ファイル変更前に拒否。atomic保存時の権限・Finderタグ保持、
  新規作成途中失敗の案内、Save Asの単独ファイルbookmark記録を追加。
- **Local Assist:** 既存R1/R2-a/b/c/R3を維持。校正のみで数字・リンク・Markdown構造が変わる案を拒否。
  自作13原稿のhelper評価は15試行中13完成、2エラー。意味・固有名詞・文章品質の全合格ではない。
- **検証・候補:** [品質レビュー](reviews/2026-09-08-v2.9-quality-hardening.md)と
  [2.9.0候補](releases/2.9.0-source-tag.release.md)に現行証跡と残項目を集約。
  7テーマの代表画面と本全体PDFはローカル追試済み。IME・VoiceOver・旧OS・
  Apple署名候補の実操作は次段階。外部差分再レビューは通過済み。
- **配布:** 署名済みローカルpkg **2.9.0 / build 125** を2026-09-09のPDF末尾空白・本全体の未保存表示修正を含むクリーンソースから再作成・署名検証済み。旧pkgは別保存し、現行SHAは候補記録を参照。Appleへのupload・処理・配布・公開は未実施。
  既存のApp Store bundleVersion変更を含むユーザー作業は保持する。
- **次:** TestFlight配信と同一候補での実機受け入れ確認。コード修正が入れば候補を再構築する。
- **版別境界:** System-only改善。v3.0はAFMと共通基盤、v3.1はC-1/C-2。
  C-1/C-2のHOLDとMLX停止を維持。`docs/v2.9-v3-local-assist-plan.md` を参照。
- Habitat 1.1.1は警告なし。公開済みのタグ・アセットは変更しない。

## Implementation / Candidate History（2026-09-07以前）

以下は各時点の実装・候補・検証履歴。文中の「未公開」「次」は当時の記録であり、
現行キューは上記と `docs/current-work.md` を使う。過去の実機未確認を今回合格へ変更しない。

- **PR #40 Preview follow-up (2026-09-07, main `c462e846`):** 空表示・描画失敗からの再試行・選択終了を
  安定化し、読むモードを隣接配置。統合レビューで旧配置のテスト2件を更新し、
  型検査・1,937 tests・Vite build・App Store surface 111 testsが成功。
  全テーマの外観・実機・VoiceOverは所有者確認。凍結済みbuild 124には未反映。
  詳細: `docs/reviews/2026-09-07-preview-reading-polish.md`。

- **v2.8 release preparation:** 統合候補の検証・残項目は
  `docs/releases/2.8.0-source-tag.release.md`。提出文案は
  `docs/releases/2.8.0-app-store-release-notes.md`。公開・送信は未実施。

- **v2.8統合候補 (2026-09-07):** ローカルmainの6コミットとPR #38/#39を統合。
  Local Assistはネイティブ別窓、縦長の会話と下部入力欄、説明は初期折りたたみ。
  生成停止・同一会話の案の復元・main Diffからの明示反映とUndoを維持する。
- Package/app version in tree: **`2.8.0`**. Release preparation, not publication.
  User-confirmed Mac App Store publication of `2.6.2` remains historical evidence.
  Frozen v2.7 candidate provenance

  is in ignored `docs/internal/app-store-candidates/latest.json`. What's New:
  `docs/releases/2.7.0-app-store-release-notes.md`. Active plan:
  `docs/v2.8-plan.md`. U-1 and H-1/M-0a are integrated. Validate the
  detached companion and main Diff before further U-3/U-4/G-1 work.
  C-1 (`.aimodel` DL) HOLD until a production identity. Local-only for now;
  web search is a later optional lane.
  A local `2.7.0` / build `123` pkg exists. The owner plans to send it to App
  Review, but no upload / processing / approval / publication result is
  recorded. The pkg was built before the v2.7 transition was committed;
  ignored candidate metadata therefore records `sourceDirty: true`.
  The v2.7 freeze checkpoint is `d1db159a`; it is a reproduction boundary,
  not proof that build `123` came from a clean commit.
- **Current release evidence:** `docs/releases/2.8.0-source-tag.release.md`.
  Prior v2.8 development and PR #39 test counts describe their separate trees;
  the integrated candidate needs fresh checks and physical Assist smoke.
- **C-0 is a pre-development lock:** `docs/core-ai-c0-design.md`.
  Advisory: `docs/core-ai-c0-external-review-2026-08-27.md`.
  **U-\* / H-1 / G-1 = GO.** C-1 waits on identity + `resourceManifest` +
  Background Assets/AOT. C-2 waits on backend-specific availability and
  Rust-owned `selectedId`. TS generate must not send `backend`. Do not
  reopen the v2.6 apply boundary. Do not use “Notion AI 級” as a Goal.
- **MLX M-0a preflight is complete locally:** commits `b7ca1a8e`, `2a1f63b6`,
  and `965867ca` lock the design, reuse the immutable process-local System
  model with a fresh session per request, and add the Rust-only fail-closed
  `backend: "system_default"` wire. Missing backend stays compatible;
  `coreai` / `mlx` / unknown fail with `unsupported_backend` before model use.
  Renderer / companion / public Tauri requests still cannot select a backend.
  No dependency, lockfile, model, network acquisition, storage, URL/path,
  Preferences UI, or App Store exposure was added. Review
  `docs/mlx-m0a-external-review-brief.md` over `00f179ab..HEAD`. Do not start
  M-0b until C-2 plus an Xcode 27 / macOS 27 build lane are ready.
- **Right-pane exclusive owner (2026-08-27):** 参照中に「確認」を押しても
  Diff が出ない不具合を直した。右列は参照 XOR Preview / 電子書籍 /
  アウトライン / 差分。確認・ファイル比較・参照ペイン内「差分」が
  サイドペインを開くとき参照は隠す（読み込みは retained）。参照が
  表示中は side pane を非表示扱いし、Diff workbench CSS でエディタが
  消えないようにした。実機での参照→確認 / 参照内差分→参照復帰は
  smoke-checklist item 20。
- **Preview paint/selection stability (2026-08-27)** sits on `main` with the
  theme polish. Right Preview no longer copies image-resolved innerHTML
  back into React (that rebuilt the tree, killed selection, and collapsed
  then grew the card). Markdown DOM is owned by a layout-effect paint;
  resolved images are cached and reapplied before paint; reserved image
  height stays until decode; HTML commits wait out an in-preview pointer
  selection. Editor↔Preview scroll sync and view-state writes pause for
  the whole pointer gesture, not only after a range exists. Dragging a
  selection to the pane edge auto-scrolls the scroller (WebKit does not
  do this for descendant content). A click that ends a text selection
  does not follow Preview links. Debounce, lazy image reads, and
  scroll-ratio restore on document change are unchanged. Manual check:
  smoke-checklist item 15.
- **Theme polish (2026-08-27)** is on `main` after
  `01fade1c` (Preview selection/opaque paper) as `b27d3aca`. Reading surfaces stay
  readable: L Mode night palette now covers edohigan/crt/shinkai, joke-theme
  text glow/flicker is cleared from L Mode prose, and e-book / whole-book
  Reader pages use the same opaque paper as right Preview. Shell shaders,
  scanlines, boot, and ambient particles were not removed; overlays, glass
  chrome, save-affirmation, command palette, and CRT phosphor were
  strengthened. Solid accent buttons use `--surface` (or gradient +
  `--accent-contrast`) instead of white-on-sage. Do not revert these CSS
  files as unrelated.
- Published Mac App Store (user-confirmed 2026-08-28): **`2.6.2`** closed
  line; hotfix only. Prior store baseline `2.4.0` remains historical. Tags
  remain immutable. A GitHub `v2.6.2` tag is not claimed.
- **v2.5 is released and closed** (user-confirmed). W-1, R-1, Q-3/Q-4/Q-5,
  and the Q-13 measured no-op remain historical release evidence; do not reopen
  that line from v2.6. Plan: `docs/v2.5-plan.md`.
- **A-1–A-4 source work is merged.** Local Assist
  sends a generation-only proposal event; the detached window pins
  tab/session/range/original on the first request, keeps follow-ups on that
  target, and replaces the current proposal in the same Diff review. The Diff
  Apply action sends only that reviewed proposal, the main window revalidates
  stale state, clears any older post-apply Review Bar state, and does not
  enqueue a second confirmation for the already-reviewed proposal or auto-save.
  The proposal keeps the generation-time bounded `actionId`, so
  edited request text cannot change Apply provenance. Partial helper output and
  `HAZAKURA_ORIGINAL` markers are
  sanitized before they reach Diff or the editor. The A-4 narrow-layout slice
  changes detached-window CSS: the proposal owns the bounded height, Diff rows can
  shrink below the old `32rem` minimum, and the change summary wraps below
  `520px`. The finishing slice also exposes Diff column headers to the
  accessibility tree, separates cancelled feedback from failure, and shows a
  probe-in-flight availability message. IPC, proposal state, apply, save, and
  target validation are unchanged. The review branch was merged and deleted;
  source tagging, package/upload, publication, and physical validation remain
  separate gates. No new PR is required by the current workflow.
  Historical baseline: `docs/v2.6-plan.md`; active plan: `docs/v2.8-plan.md`;
  design:
  `docs/local-assist-conversational-edit-ux.md`.

- **Local Assist prompt + visibility polish is merged.** The A-2 revision
  packet now uses Japanese meta labels, omits the pinned original on the first
  turn (the target text already IS the original, so pinning it duplicated the
  target and wasted the context window), and tells follow-up turns that the
  target text is the current proposal to keep prior changes. Candidate
  sanitization now strips recognized conversational lead-ins (only a full
  lead-in sentence or a label directly followed by a clear separator such as
  「修正後：」/「Translation:」; bare prefix matches are kept so ordinary
  content like 「修正後の利用規約」 or 「Translation memory」 is untouched). The Swift helper prompt labels the target
  「対象本文（これを書き換える）」 and asks for the completed text only. The
  detached window now shows the raw growing draft while a proposal streams
  instead of recomputing a line diff on every partial. The Swift prompt change
  is compile-verified only and takes effect after the live helper is rebuilt;
  the Rust suite still exercises the fixture helper.

- **Local Assist review moved to the main window (B2).** The unapplied-proposal
  Diff review and Apply/Discard now live in the MAIN window as a large
  editor-font `LocalAssistProposalReview` panel (reusing `DiffBody`), while the
  detached window keeps only the conversation, the raw growing-draft preview,
  and Cancel. The proposal is held in a new session-local
  `localAssistProposalStore` (keyed by tab session), separate from
  `AiEditTransaction`; `applyReviewedLocalAssistProposal` is the single apply
  path (revalidates target/session, rewrites the unsaved buffer once, clears any
  older post-apply Review Bar state, and does not enqueue a second review for
  the already-reviewed proposal, then clears the proposal). The detached
  window resets its conversation on an apply `completed`/`discarded` status
  from the main window. Legacy dead code (Rust `request_apply_ai_edit_transaction`
  / `APPLY_AI_EDIT_TRANSACTION_EVENT`, TS `requestApplyAiEditTransaction` and
  `buildProposalApplyEvent`) remains and is safe to remove in a follow-up slice.

- **B2.1 hardening (merged on top of B2).** (1) Generation start marks the
  pending proposal `streaming: true` and the main window's Apply/Discard pass
  through `rejectIfAppleAssistLocksTab`, so a stale candidate cannot be applied
  mid-generation; completion also re-reads the target text. (2) Apply status
  carries `conversationId` and the detached window resets only the matching
  conversation. (3) A stale/no-op Apply surfaces `setStatus` + an inline error
  in the review panel. (4) The Diff now uses `editorSettings.editorFontSize`.
  (5) Any older post-apply Review Bar is hidden while an unapplied proposal is
  pending; reviewed apply clears that state and does not enqueue another bar,
  so the two floating panels never overlap or ask for a second confirmation.

- **B2.2 terminal cleanup (merged).** A generation that never reaches a
  completed proposal now settles the streaming placeholder: cancel/helper
  failure restores the previous completed proposal (or clears when there was
  none), while a stale target or session change clears it. The settle is
  guarded by the placeholder's own `requestId`.

- **OKF pin:** v0.2 at `3fcbb9f828c2f23d109c855ee403c3a4c81f3a96`.
  New optional trust/lifecycle/attestation fields are inert data. Legacy v0.1,
  `timestamp`, and `# Citations` stay readable without migration or execution.
- **Book-like starter shows the whole shape:** `index.md` links a four-part
  beginning / development / turning-point / ending arc plus overview,
  character, and setting notes. These are short editable prompts and remain an
  illustrative scaffold, not OKF or Book Scope chapter-order semantics. Every
  concept file also carries a visible body H1 instead of relying on frontmatter
  title presentation.
- **B-1 chapter Diff:** an available Book row opens/reuses its chapter tab and
  reviews the current buffer against disk through the existing Diff. Dirty
  buffers win; unavailable rows are disabled. No save/apply, second editor
  buffer, Git comparison, or persistence change was added. Self-review
  serialized repeated chapter opens so only the newest request can enter Diff.
- **OKF self-review:** the official v0.2 optional-family fixture now includes
  sibling `usage_window`, a bare `verified` mapping, valid `sources`, and the
  documented computation/executor/attester shapes. These remain inert data.
- **First Alpha spine is in source:** existing sidebar Files / Book switch,
  explicit Markdown selection, app-private ordered document/group tree,
  same-parent reordering, unavailable-entry retention/recheck, chapter switching
  through the existing single editor, and Rust path/symlink/100-chapter
  validation. Version-1 flat settings migrate as root chapters without
  reinterpreting the workspace; re-Suggest + Save explicitly adopts hierarchy.
- **Explicit chapter suggestions are in source:** Book view can run the existing
  bounded/cancellable OKF snapshot on demand, adapt index section headings plus
  safe relative / bundle-root links into a document/group tree, expand
  root-linked nested indexes in their local chapter order, append remaining
  readable `.md` paths, and open the result as an unsaved checkbox draft. The
  saved tree has no OKF version/type field. It adds no startup/background scan
  or persistent scan cache.
- **Heavy manuscript candidate adjustment is built-app verified:** a real five-work
  e-book split into 44 Markdown files now produces 43 editable candidates with
  the default-on index-page option: root index first, then each linked nested
  index before its chapters, followed by root supplementary notes. Turning the
  option off preserves the previous 37-item body draft; `log.md` stays excluded.
  Signed TestFlight PDF/EPUB appearance is held.
- **Whole-book reader is in source:** explicit Book action, saved scope order,
  live dirty buffers before disk, chapter-relative image/link bases, 32 MiB
  total budget, visible unavailable/skipped notices, and edit return through
  the existing tab path. It is read-only and does not create a second buffer.
- **v2.1 whole-book search is in source:** the Reader searches only its already
  loaded chapter names and visible Markdown under the existing 100-chapter /
  32 MiB budget, including unsaved live buffers. Results show chapter and
  occurrence counts and jump through the existing contents list. Escape clears
  input before closing. `Command+F` is routed to the Reader search instead of
  the hidden editor find bar; Enter / Shift+Enter advances through matching
  chapters with wraparound. No persistent/background index, workspace scan,
  source edit, or auto-save was added; narrow windows keep search/results
  reachable.
- **Preview image loading is bounded in source:** interactive Preview and each
  whole-book Reader chapter keep permitted image references inert until near
  the viewport, reserve placeholder height, and run at most two reads per pane.
  A delayed fallback now routes still-unreported placeholders through the same
  bounded queue when nested WKWebView Preview reports only an initial false
  intersection and then goes quiet. A non-intersecting record no longer
  disables the fallback. A loaded data URL is committed into Preview state and
  the transparent placeholder's lazy flag is removed, so later React paints do
  not restore the blank placeholder. e-book/PDF/EPUB retain eager settle
  behavior. Source and media consent policy are unchanged.
- **In-file search now follows into e-book Mode:** the active `Command+F`
  result is mapped from its source offset to a Markdown line, then to the
  e-book chapter and estimated rendered page in both the right pane and
  Reading Focus. A spread target is aligned to the containing spread's left
  page; Markdown source and search indexing are unchanged.
- **Book frontmatter presentation is aligned:** closed leading YAML is stripped
  for whole-book Reader and PDF, matching EPUB, without changing source. Custom
  metadata is not mapped into cover/part/chapter semantics.
- **Book Scope export is in source:** PDF and EPUB dialogs explicitly choose
  Current file or whole book. Book output uses scope order, live dirty buffers,
  and each chapter's own document path. Preflight checks unavailable chapters,
  up to 100 workspace images, missing headings, and EPUB metadata; unavailable
  chapters block Book export before a destination is chosen.
- **EPUB navigation/link repair is in source:** the saved Book document/group
  tree is the EPUB TOC source, chapter headings retain their local hierarchy,
  and relative / bundle-root links between included Markdown chapters are
  rewritten to packaged XHTML/heading targets. Scope order remains the
  fallback. Book storage is versioned v2; Markdown source and OKF metadata are
  unchanged. Heavy-manuscript Apple Books interaction remains the manual proof
  boundary.
- **Explicit EPUB cover is in v2.3 source:** the EPUB dialog optionally selects
  one local PNG/JPEG/GIF/WebP file for that export. The archive emits a marked
  cover image and cover XHTML before content. No first-image inference, source
  rewrite, persistent cover setting, cropping, or cover editor was added.
- **Book Scope UX quieting is in source:** settled list keeps read/edit primary;
  suggest only in empty/edit setup; recheck progressive when unavailable;
  quieter path/label density; shorter OKF review intro. Further compact
  toolbar / More-menu density polish is optional post-ship residual, not a
  published `2.3.0` claim.
- **Help expansion is in source:** native Help menu / Command Palette → Books
  and knowledge folders…; About/diagnostics derive package version from package
  metadata. Saving or cancelling Book chapter selection restores trigger focus.
  Help documents default-on index cover/contents option and recent-workspace
  book-order retention. User-facing status/dialogs avoid “Book Scope” jargon;
  live book buffers also match open tabs by relative path / NFC.
- Design SoT:
  `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- Queue: `docs/current-work.md`. Roadmap: `docs/roadmap.md`.
- Advisory review pools (not the active queue):
  `docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage; L Mode
  corrections; mode pills / static lint / Compare Center held or rejected as designed).

### v1.14 Keep summary (shipped in review candidate)

- Continuity: same-name tabs; Reference retained toggle; recent workspaces;
  shared sticky right-pane header; PDF 150% scroll fix.
- Trust: export path/warnings; Assist lock & not-saved; Import draft status.
- Writing Loop: Preview vs e-book; e-book edit-here; Outline hints + heading Undo.
- OKF: scaffold pre-create list; first-fix open guidance.

### Parked (not main queue)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.

## Verification (2026-08-29, MLX M-0a preflight)

- `npm run typecheck` — pass.
- `npm test` — 217 files / 1,832 tests pass.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 369 passed / 2 ignored.
- Fixture-selected `cargo test apple_assist_supervisor` — 32 passed.
- Fixture helper smoke — missing backend + explicit System accepted;
  Core AI / MLX / unknown rejected as `unsupported_backend`.
- Live helper — Xcode 26 arm64 / x86_64 / universal builds and System probe pass.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — local helper-enabled App Store preview bundle passes;
  expected large-chunk and no-notarization warnings remain.
- Not run / not claimed: Xcode 27, `MLXLanguageModel`, an MLX model, model
  download/storage/UI, physical Assist interaction, upload, tag, or release.

## Verification (2026-08-28, 2.6.2 App Store published)

User-confirmed Mac App Store approval and distribution start for `2.6.2`.
Rollout to all users is staged over time. This pass is docs-only. Not a
GitHub source tag, GitHub Release, or 100% install-base claim.

## Verification (2026-08-27, 2.6.2 local candidate)

Not a source tag or GitHub Release. Physical 確認-with-Reference and in-pane
差分 → 参照 restore were not run in the live app. Mac App Store publication
was later user-confirmed on 2026-08-28.

- Source for local MAS pkg `2.6.2` / build `122`: `23d44fdf`
  (P1 retain-Reference Diff). Build `120` was the first 2.6.2 pkg (HOLD:
  in-pane Diff discarded Reference). Build `121` added gutter polish only.
- `tsc --noEmit` — pass.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- P1 tests in `revealReferenceTextDiff.test.ts` — pass.
- `npm run release:candidate -- --with-app-store-pkg` — local MAS pkg
  `2.6.2` / build `122` signed from `23d44fdf`; `spctl` Insufficient Context
  expected. Do not treat as uploaded.
- Full smoke-checklist (IME, dirty close, save conflict) and Assist physical
  UI were **not** re-run.

## Verification (2026-08-27, 2.6.1 local candidate)

Evidence is from `main` at `6ff22dad` plus this notes pass. It does not
claim a source tag, upload, App Review, or physical Assist UI gate.

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 368 passed / 2 ignored.
- `npm test` — 213 files / 1,819 tests pass.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm audit` — 0 vulnerabilities.
- `cargo audit --file src-tauri/Cargo.lock` — no high/critical vulnerability;
  18 allowed transitive GTK / parser / Unicode / GLib warnings.
- `npm run build:apple-assist-helper:fixture` — ok. Live helper was rebuilt
  afterward; probe `availability: { kind: "available" }`.
- `npm run build` — helper-enabled App Store preview app `2.6.1` /
  `dev.hazakura.editor`. Expected local no-notarization warning remains.
- `npm run probe:macos-distribution` — bundled `LICENSE` and
  `THIRD_PARTY_NOTICES.md` present; ad-hoc signature verifies; `spctl`
  Insufficient Context (expected).
- `SKIP_BUILD=1 npm run smoke:macos-window` on that preview app — `1280x820`
  window opened and quit cleanly.
- `git diff --check` and `docs/release-pre-check.md` hygiene on
  `v2.3.0..6ff22dad` — no release-blocking path, secret, or tracked build
  output. Hits were test fixtures, public repo links, and redaction tests.
- Full smoke-checklist (IME, dirty close, save conflict) and detached-window
  Assist physical UI were **not run**.

## Verification (2026-08-09, v2.5 workspace line)

- `npm run typecheck` — pass.
- `npm test` — 208 files / 1,740 tests pass. The expected jsdom canvas
  capability notices remain non-failing.
- `npm run build:vite` — pass. App Store lane measurement: main 1,535.76 kB
  (475.26 kB gzip), shared render chunk 221.64 kB (69.33 kB gzip), Preview
  4.45 kB (1.89 kB gzip), e-book 20.15 kB (6.74 kB gzip). Preview/e-book are
  already lazy; the known main-chunk warning remains.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — helper probes and ad-hoc App Store preview app build pass
  for `2.5.0`.
- Native window smoke — `dev.hazakura.editor`, `1280x820`, onscreen and clean
  quit. Computer Use then verified the left splitter by keyboard (280 → 299)
  and drag (→ 365), the right splitter by keyboard (42 → 47), and removal of
  the left splitter while the Workspace is collapsed. Widths were restored to
  280 / 42 afterward; Markdown content was not edited.
- A signed universal `2.5.0` submission pkg was generated after committing the
  implementation boundary. Candidate provenance records a clean source commit,
  and independent payload metadata, architecture, checksum, app signature, and
  installer-signature checks passed. The build counter is now 115. TestFlight
  upload/install, App Review, and publication are not claimed.

## Verification (2026-08-09, v2.5 R-1)

Superseded for the current v2.5 workspace line by the verification block above;
retained as the earlier R-1-only checkpoint.

- R-1 red/green CSS contract: `workspaceCss.test.ts` failed on the fixed 12.5px
  rule, then passed after text Reference adopted `--preview-font-size`.
- `npm run typecheck` — pass.
- `npm test` — 205 files / 1,729 tests pass on the clean rerun. An earlier
  parallel first pass emitted one late CodeMirror `requestAnimationFrame`
  error from `useSlashMenu.test.ts`; no assertion failed and the isolated full
  rerun was green.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — helper probes and local ad-hoc App Store preview build pass
  for `2.5.0`. Window smoke opened a `1280x820` main window and quit cleanly.
- Manual minimum/maximum Preview-font changes inside text Reference, signed
  TestFlight, pkg, upload, App Review, and publication are not claimed.

## Verification (2026-07-29, v2.4 OKF + B-1 + book-like starter)

- `npm run typecheck` — pass.
- `npm test` — 205 files / 1,728 tests pass.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run smoke:fixtures:v1.11-okf` — v0.2 pin, optional-family, and legacy
  v0.1 bundles generated successfully.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — local helper-enabled App Store preview app built with
  ad-hoc signing; helper probes passed. `SKIP_BUILD=1 npm run
  smoke:macos-window -- '<built app>'` launched a `1280x820` main window and
  quit cleanly.
- `npm run release:candidate -- --with-app-store-pkg --no-prune-pkgs` —
  App Store surface 111 tests passed; universal app and both helpers were
  Apple Distribution signed; the installer pkg was signed and recorded in the
  ignored candidate provenance note.
- Independent package checks — SHA-256 matched the candidate note; payload,
  app metadata, minimum OS, universal architectures, deep signature, helper
  inheritance entitlements, and synthesized installer XML all passed.
- `npm run smoke:macos-sandbox-preview` — pass after running outside the
  restricted cache sandbox.
- Isolated latest Developer bundle smoke — sidebar New created the expanded
  nine-file book-like starter in an empty temporary workspace; `index.md`
  opened with four chapter and three design-note links, and the first chapter
  opened with a visible body H1. Other creation entry points and installed
  TestFlight remain unverified in this pass.
- Package provenance caveat — the existing local package was built before the
  scaffold-expansion commit and before this quality hardening. Its metadata
  records only an older base `sourceCommit`. The candidate wrapper now records
  `sourceDirty` and a changed path count before future builds. Hold the existing
  package; commit this slice and rebuild before upload.
- `cargo audit --no-fetch --file src-tauri/Cargo.lock` — no vulnerability;
  18 existing allowed warnings. A fresh `npm audit` was not run because its
  external dependency-graph submission was not authorized.
- The signed submit app cannot be launched directly on this host without a
  Store/TestFlight receipt (`RBSRequestErrorDomain Code=5`); focused
  Book-row/OKF interaction smoke remains **not run** and must use the installed
  TestFlight build. Upload, Apple processing, TestFlight launch, App Review,
  and publication are not claimed.

## Publication (2026-07-24)

- Mac App Store **`2.3.0`** App Review passed and the release was published
  (user-reported). Store notes:
  `docs/releases/2.3.0-app-store-release-notes.md`.
- GitHub source / local-app tag **`v2.3.0`** (source archive only; no binary
  assets). Notes: `docs/releases/2.3.0-source-tag.release.md`. Prior tag
  `v2.0.0` remains immutable (do not move).
- Hotfix discipline: only reproduced daily-use / review blockers on the
  published line. Do not reopen the store lane for polish.

## Verification (2026-07-23, v2.3.0 Book UX + image/export repair)

- Focused image/EPUB slices: 6 files / 122 tests pass, including missed
  intersection fallback, Preview/Reader regression, explicit cover dialog,
  archive contract, and selected-cover file loading.
- Follow-up nested-Preview regressions: focused red tests confirmed both that a
  non-intersecting observer record cancelled the delayed fallback and that a
  same-props React rerender restored the transparent placeholder after a data
  URL had appeared.
- Recent-folder App Sandbox regression: folder history now stores a separate
  security-scoped bookmark per workspace; focused tests cover direct-path
  denial, bookmark resolution, legacy-entry picker reauthorization, and fresh
  bookmark persistence. Local App Store distribution builds signed correctly
  but macOS rejected launching them without a Store receipt, so the final
  interaction remains an installed/TestFlight check.
- `npm run typecheck` — pass.
- `npm test` — 205 files / 1,721 tests pass on tree `2.3.0`.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — helper-enabled App Store preview `.app` built successfully;
  ad-hoc signed, not notarized and not a submission pkg.
- `npm run build:developer-preview` — pass after the Reader and e-book search
  routing fixes.
  Computer Use confirmed `Command+F` focused **本の中を検索** and Enter moved
  a 43-chapter real manuscript from chapter 1 to chapter 2, including visible
  active-label and manuscript scroll movement. A separate real-document smoke
  confirmed the in-file search moved the e-book right pane to chapter 3 / page
  4, then Reading Focus to the containing spread at page 3 / 5 with both pages
  visible; the Developer preview app was quit after verification.
- Generated covered EPUB — external `epubcheck` 3.3: 0 fatal errors / 0 errors /
  0 warnings.
- Build 107 bundle smoke is invalidated and that pkg remains held. Computer Use
  reproduced its flash-then-blank behavior with the real parent workspace,
  nested `index.md`, and 2.6 MB `images/c00.png`. In the repaired build, Preview
  retained the image after 12 seconds and after close/reopen; e-book page 2
  retained the same image after 10 seconds. Before upload, confirm ignored
  candidate metadata points to a commit containing the later recent-folder
  bookmark repair as well.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm audit` / `cargo audit` — not completed in this pass. External advisory
  access was unavailable under the current execution boundary; do not treat
  dependency audit as freshly passed.
- Version surfaces (npm / Tauri / Cargo / lockfiles / living docs alignment
  tests) report `2.3.0`.
- Fresh signed universal App Store pkg candidate for `2.3.0` was recorded in
  `docs/internal/app-store-candidates/latest.json`; signature, entitlements,
  bundled helpers/notices, installer signature, and SHA-256 checks passed.
- Publication of Mac App Store `2.3.0` was later user-reported (2026-07-24).
  This verification section remains pre-publication local evidence.

## Verification (2026-07-22, v2.1.0 candidate base)

- Focused Reader search: 2 files / 10 tests pass; frontmatter exclusion,
  Unicode/case normalization, result filtering/jump, and Escape clear are pinned.
- Focused Preview image hardening: 3 files / 33 tests pass; near-viewport
  deferral, two-read concurrency, consent-specific loaders, failure notes, and
  reserved placeholder height are pinned.
- Previous helper-enabled App Store preview build and fresh signed universal
  pkg for the image-hardened `2.1.0` tree passed deep signature and provenance
  checks on that tree.

## Verification (2026-07-18)

### Book Scope ordered tree + flexible OKF link adapter

- `npm run typecheck` — pass.
- Focused Vitest (Book model/storage/suggestion/panel/controller + EPUB export)
  — 9 files / 88 tests pass.
- `npm test` — 201 files / 1,678 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — helper probes and helper-enabled App Store preview build
  pass; bundle reports `2.0.0`.
- `codesign --verify --deep --strict --verbose=2` — pass for the rebuilt app.
- `npm run smoke:fixtures:v1.11-okf` — pinned `ee67a5c` fixture bundles
  generated successfully.
- `SKIP_BUILD=1 npm run smoke:macos-window -- '<built app>'` — pass; the
  rebuilt `2.0.0` app launched, exposed a `1280x820` window, and quit cleanly.
- Automated coverage pins v1 flat-scope migration, bounded tree sanitization,
  same-parent movement, nested index-heading groups, relative/bundle-root link
  adaptation, saved-tree EPUB navigation, included `.md` link rewrites,
  same-chapter cross-page-break anchors, external-link preservation, and
  conservative unknown-fragment fallback.
- Not run: heavy-manuscript export opened/clicked in Apple Books or signed
  TestFlight; keep that as the next proof boundary and do not infer it from the
  disposable fixture below.

### Release-quality disposable export smoke

- A throwaway nested workspace under `/private/tmp` covered Preview headings,
  two local images, root/nested index links, Book Scope save, whole-book Reader,
  and an explicit page-break section without clipping or source mutation.
- The saved five-entry tree showed `Works → One → Chapters` and `Notes`; Reader
  rendered all five entries in order. PDF export produced seven A4 pages; all
  pages were rendered with Poppler for visual review and showed no clipping or
  overlap.
- EPUB export passed `epubcheck` with 0 errors and 0 warnings. Archive inspection
  confirmed two packaged images, saved-tree navigation, spine order, metadata,
  and rewritten relative/bundle-root links. macOS Books displayed the nested
  TOC; `First` → `Second` reached the `Second Section` target in the packaged
  chapter. `pdftotext` was unavailable, so PDF evidence used `pdfinfo` and
  rendered PNG pages.

### Heavy nested-index manuscript adjustment

- `npm run typecheck` — pass.
- `npm test` — 201 files / 1,667 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — live helper probes and local ad-hoc App Store preview build
  pass; bundle `2.0.0`, deep/strict code-sign, bundled notices pass.
- Built-app smoke — real manuscript default Suggest reported 43 items (37 body,
  6 root/nested indexes); option-off Suggest returned 37; `log.md` stayed out;
  Cancel used, no scope saved. Reader displayed body without closed leading YAML.
- Whole-book PDF smoke — A4, 289 pages; extracted PDF text contained none of the
  ASCII `type: Chapter`, `description:`, or `tags:` keys. Bundled Poppler lacked
  Japanese font mapping, so signed TestFlight PDF/EPUB visual appearance remains
  unclaimed.

### Help + version 2.0.0 slice

- `npm run typecheck` — pass.
- `npm test` — 201 files / 1,664 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `cargo audit --file src-tauri/Cargo.lock` — exit 0; 18 allowed known
  Tauri/Linux and unmaintained transitive warnings, no vulnerability finding.
- `npm run build` — helper live probes and helper-enabled App Store preview
  build pass. Bundle version is `2.0.0`, deep/strict code-sign verification
  passes, and packaged window launch smoke shows an onscreen app window.
- Version surfaces: package.json, package-lock root, tauri.conf.json,
  Cargo.toml, Cargo.lock package; About Help and diagnostics read package
  metadata rather than repeating a separate version literal.
- Tag / App Store pkg / upload **not** performed.

### Prior candidate proof (Book interaction breadth)

- Earlier same-day Book Scope export/reader smoke remains the last direct
  interaction evidence for the multi-file spine. All automated, Rust, audit,
  package, signing, and launch gates above were re-run after the UX review.

## Verification (2026-08-27, Preview paint / selection stability)

- `npm run typecheck` and `npm test` (1814 passed). `git diff --check`
  pending at report time.
- Built-app visual smoke of Preview selection + image load was **not**
  run. Use `docs/smoke-checklist.md` item 15 on a live window.

## Verification (2026-08-27, theme / reading-surface polish)

- `npm run typecheck` and `npm test` (1807 passed) after CSS-only
  usability and theme-effect polish. `git diff --check` clean.
- Built-app / Vite visual smoke of every theme was **not** run in this
  slice (no desktop launch, no browser MCP). Manual check remains
  `docs/smoke-checklist.md` item 14, now also covering e-book pages and
  whole-book Reader paper.

## Verification (2026-08-16, v2.6 A-3)

- `npm run typecheck` passed.
- `npm test -- --run` passed: 209 files / 1,759 tests.
- `npm run build:vite` passed (existing large-chunk warning only).
- `npm run smoke:app-store-surface` passed: 10 files / 111 tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed: 368 passed / 2 ignored.
- `npm run build` passed: helper-enabled App Store preview bundle; existing
  large-chunk warning only.
- `SKIP_BUILD=1 npm run smoke:macos-window` passed: packaged 1280×820 native
  window opened and quit cleanly.
- Focused A-3 tests cover reviewed-proposal-only apply, stale session rejection,
  transaction/Review Bar recording, apply-status terminal handling, and
  `HAZAKURA_ORIGINAL` boundary sanitization, including generation-time
  `actionId` retention through explicit Apply.
- Built-app/manual Assist streaming, cancel, narrow-layout, and physical-device
  availability smoke remain external-review or human-gated evidence; they were
  not claimed here.

## Verification (2026-08-16, Local Assist review moved to main window — B2)

- `npm run typecheck` — pass.
- `npm test` — 211 files / 1,786 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `git diff --check` — pass.
- Focused regressions pin: the proposal store / `useLocalAssistProposal`,
  `applyReviewedLocalAssistProposal` (session-keyed write, stale original/session
  rejection), the main-window `LocalAssistProposalReview` panel, the detached
  window's conversation-only rendering plus conversation-id-matched reset, the
  streaming placeholder at generation start, and the inline apply error.
- Note: the Rust code is unchanged from the v2.6 source candidate; the Rust
  suite (`cargo test`, 368 pass / 2 ignored) was last verified on that tree.
  The live Swift helper still needs rebuilding before any live/package build.

## Verification (2026-08-16, Local Assist prompt + visibility polish)

- `npm run typecheck` — pass.
- `npm test` — 209 files / 1,777 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 368 pass / 2 host-dependent ignored.
- `swift build -c release` (live helper, `src-helpers/apple-assist`) — pass,
  confirming the edited live prompt strings compile.
- `git diff --check` — pass.
- Focused regressions pin: first-turn omission of the pinned original,
  follow-up Japanese framing, preamble stripping, and the raw-draft streaming
  presentation.
- Note: this slice does not rebuild the live Swift helper for package/live
  builds. A package build (or `scripts/build-apple-assist-helper-live.sh`) is
  required before the Swift prompt change is observable in a live or App Store
  build.

## Verification (2026-08-16, v2.6 source candidate)

- `npm run typecheck` passed.
- `npm test -- --run` passed: 209 files / 1,766 tests.
- `npm run build:vite` passed (existing large-chunk warning only).
- `npm run smoke:app-store-surface` passed: 10 files / 111 tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed: 368 passed / 2 ignored.
- `npm run build` passed: helper-enabled App Store preview bundle; existing
  large-chunk warning and expected local no-notarization warning only.
- `SKIP_BUILD=1 npm run smoke:macos-window` passed: packaged 1280×820 native
  window opened and quit cleanly.
- `npm audit --audit-level=high` passed: 0 vulnerabilities.
- `cargo audit --file src-tauri/Cargo.lock` passed with 18 allowed transitive
  unmaintained/unsound warnings and no high/critical vulnerability report.
- Focused Assist / CSS regressions passed: 4 files / 97 tests.
- `git diff --check` passed before handoff.
- Detached-window narrow-width interaction, keyboard/focus order, VoiceOver,
  locale, streaming/cancel, and physical-device availability remain external
  review or human-gated evidence.

## Durable Pins

- Safe Editor primary; Markdown/text source canonical (per file in v2).
- No indexing, auto-apply, auto-save, second editable buffer as default.
- App Store lane: no Agent Workbench / external CLI agent.
- Import Assist: on-device, edit-before-save, no cloud OCR auto-save.
- OKF: explicit, bounded review + explicit scaffold; no auto-repair.
- v2: explicit user-selected Book Scope only; base OKF ≠ Hazakura Book order.
- PDF export path remains direct PDF export (not macOS print UI).

## Next For Agents

1. `docs/current-work.md` とv3.2依存受け入れドラフトを読み、現行候補の実機受け入れを優先する。
2. ソース試験、候補CI、実モデル、IME/VoiceOver、旧OS、署名済みTestFlightの証跡を区別する。
3. v3.2後はメモ系と縦書きを個別設計する。詳細は `docs/post-v3.1-writing-completion-draft.md`。
4. AIによるメモ作成・メモを使った推敲は品質再評価後。Core AI / MLX / anydocの別ゲートを守り、
   背景index・永続チャットへ広げない。モデルソースの設計は `docs/core-ai-model-source-abstraction.md`。
5. 公開済み版・タグ・アセットは変更せず、新しい提出・公開は別工程として扱う。

## Key Paths

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| 次期plan | `docs/v2.9-v3-local-assist-plan.md` |
| v2.8履歴 | `docs/v2.8-plan.md` |
| v2.6 implementation history | `docs/v2.6-plan.md` |
| v2.5 plan | `docs/v2.5-plan.md` |
| Conversational Assist UX | `docs/local-assist-conversational-edit-ux.md` |
| Assist strategy | `docs/assist-surface-strategy.md` |
| MLX M-0a boundary | `docs/mlx-m0-preflight-design.md` |
| MLX external review | `docs/mlx-m0a-external-review-brief.md` |
| Phase / path | `docs/roadmap.md` |
| Closed v2.4 plan | `docs/v2.4-plan.md` |
| v2 Book design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| Status truth | `docs/current-status.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| Smoke | `docs/smoke-checklist.md` |
| App Store build | `docs/app-store-build.md` |

Local package provenance remains in
`docs/internal/app-store-candidates/latest.json`; do not copy per-build paths or
hashes into this handoff.
