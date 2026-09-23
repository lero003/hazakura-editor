# Core AI pack更新とモデル設定の表示確認

Status: source / fixture / 隔離ad-hoc sandbox確認。実Background Assets・TestFlight受入ではない。
Date: 2026-09-23

## 2026-09-24 外部レビュー追補

`352a0ffc`への追加P2 2件をsourceで是正した。再起動後に旧プロセスの
`ensureLocalAvailability` completionを失った場合、進行中downloadやdelegate通知から最新版の
ensureへ再接続する。要求versionと操作世代を保ち、旧版finishedだけではReadyにしない。
`src-tauri/native/background_assets_bridge_reconnect_test.m`は再起動相当のcontroller、旧版通知、
ensure完了後の遷移を模擬し、macOSのnative CIで実行する。
`busy` probeは65秒の全体期限まで上限8秒間隔で再試行する。20秒後の復帰・モデル変更・unmount・
期限到達をfrontendテストで確認。frontend 2710件・scripts 31件、Rust 477件pass / 3 ignored、
native回帰テスト、型検査、Vite、App Store surface 132件、Rust fmt、`npm run build`は成功。
実Background Assets配信は未試験。build 153のpkgには修正が入らず、次の署名済み候補が受入対象。

## 対象

- 同じasset pack IDで互換な新versionを取得する。旧版が利用可能でも最新版の取得完了まで検証しない。
- pack内manifestのmodel ID、runtime kind、schema、サイズ・path・全SHA-256を確認する。
- 選択中modelの更新が検証された後、helperのpathも新版へ切り替える。生成中なら監視して再試行する。
- 初回配布catalogは12Bのみ（最低16 GB・推奨24 GB）とし、設定画面では状態・操作・容量を読みやすくする。

## 表示fixture

`./node_modules/.bin/vite --host 127.0.0.1 --port 1420`で起動し、
`fixture.html`を開く。`?ready=1&theme=dark`は12Bを利用可能にしたダーク表示。
`?local=1`は外部モデル選択中の固定例文試用を模擬する。
IPCは模擬であり、実際のダウンロード・削除・生成はしない。現行fixtureは12Bのみ・
最低16 GB/推奨24 GB・検証失敗時の「削除して再取得」を表示する。ブラウザーの
アクセシビリティツリーで、E4B行がなく、12Bの情報と復旧操作が見えることを確認した。
`?local=1`を600px幅で操作し、試用結果がカード内に収まることも確認した。

以下のPNGは**方針変更前**のE4B/12B表示を撮った履歴画像であり、現行fixtureの見た目ではない。

- [変更前の失敗表示](01-models-ja-recovery.png): 12Bで再試行と削除を別々に出していた。現行は一つの復旧操作に変更。
- [利用可能時の更新確認](02-models-ja-ready-dark.png): 「更新を確認」と選択操作を分ける。
- [600px幅](03-models-ja-narrow.png): 操作ボタンはカード本文の下へ移り、横にはみ出さない。
- [ローカルモデルの試用・600px幅](04-models-ja-local-check-narrow.png): IPCを模擬した結果表示。実モデル生成の証跡ではない。

## 検証境界

Rustのpack更新・破損拒否・helper切替の回帰テスト、frontendの操作テスト、型検査、Vite build、
App Store surface smoke、macOS 27 SDKでのnative bridgeコンパイルを確認した。
Apple CDNからの取得、旧版削除済みMacでのbuild更新、16 GB / 32 GB実機生成、VoiceOverは別ゲート。

## 外部レビューP2と外部フォルダ権限（現行source）

- 検証に失敗したApple資産は確認後に削除→再取得し、再検証する。通信失敗は再試行を出す。
  削除対象はApple管理の資産と検証receiptに限り、外部登録モデルをこの経路に通さない。
- receiptはpack version、manifest digest、materialized root、全ファイルのサイズ・mtime・ctime・
  device・inodeに結び付ける。一致しない場合は全payloadのSHA-256を再計算する。
  同サイズの改変後にmtimeを戻しても失敗するfixtureを通した。
- 監視はsnapshot取得と検証後に世代を再確認し、状態・選択復元・イベント反映を同じ排他区間で行う。
  古い監視を止めて新しい監視を先に完了させる競合fixtureを通した。
- 外部フォルダは本体用の永続read-only bookmarkを保存する。helper要求ごとに本体でscopeを開き、
  一時的なimplicit bookmarkを渡し、通常・streaming・probeの応答完了まで両プロセスでscopeを保持する。
  `.aimodel`だけの選択は親・兄弟ファイルへの権限と見なさず、resource rootの選択を要求する。

`npm run typecheck`、`npm test`（frontend 2698件、scripts 31件）、`cargo test`（473件pass・3件ignored）、
Rust fmt、`npm run build:vite`、`npm run smoke:app-store-surface`（132件）、
`npm run build`、`SKIP_BUILD=1 bash scripts/smoke-macos-sandbox-preview.sh`が通った。
最終buildの別bundle ID隔離コピーは、開始画面と新規・既存ファイルを開くボタンまで表示した。
これはad-hocローカルプレビューであり、Apple配信モデルの取得はプレビュー内で利用不可と示す。

## 外部フォルダの隔離sandbox実操作

初回smokeで外部E4B v2 resource rootは登録・復元できたが、`detected`行に「使う」が出ず、
Local Assistの選択肢も無効だった。`external_local`を`app_managed_local`と同じ選択判定へ修正し、
両画面の失敗先行テストを追加した。起動直後に本体とLocal Assistのprobeが重なるとnative helperが
一時的な`busy`を返し、選び直すまで利用不可のまま残ることも再現した。busyだけを最大5回・
計15.5秒の範囲で再試行し、他のエラーはそのまま表示する回帰テストを加えた。

修正後の`npm run build`から別bundle IDの隔離コピーを作り、Background AssetsのInfoキー・extension・
App Group entitlementを外して、親アプリと3 helperをad-hoc sandbox署名した。これは配布pkgとは
別のローカル試験形状。実E4B v2フォルダを登録して「使う」で選択し、完全終了後も選択を復元した。
短文のLocal Assist要求は`generate_apple_assist_candidate_streaming`経路でDiff提案を返し、
本文への自動適用はなかった。元フォルダ15ファイルのSHA-256は生成前後で一致した。

APFS cloneの試験用フォルダを選択後に移動すると、一覧は「利用不可」と再指定の案内を表示した。
再起動後はSystemへ戻り、失効登録を残した。失効登録を解除して移動先を選び直すと、再び
E4Bのstreaming生成がDiff提案まで成功した。元のE4Bフォルダの登録解除後も元ファイルは残った。
`npm run build`の元bundle IDの`.app`も`open -n`で起動し、ウィンドウ表示を確認した。
最終sourceから作り直した隔離プレビューでは、保存済みの外部E4B選択を手動で選び直さずに
streaming生成がDiff提案まで通った。3,600字の生成中に「Stop generating」を押すと
「Request cancelled. The document was not changed.」と表示され、本文は元の3,600字のまま。
Apple Intelligenceへ切り替えた後にE4Bへ戻すと再び利用可になり、同じ長文の生成が
Diff提案まで完了した。元本文は未適用で、校正前の内容のままだった。
別の3,600字生成中はモデル選択UIが無効となり、停止後に再び選択可能だった。
Rustの生成予約中選択拒否・保存値不変更テストも単独で再実行して通過した。
Core AI helperの`generate_candidate`を実E4B v2のresource rootとapp-managedテストIDで
通常macOS権限から直接呼び、
`candidate` envelopeと`were`→`was`の短文校正を確認した。制限付き実行環境では
`noMetalDevice`で失敗したため、通常権限で再実行した。これはhelper単体のnormal経路であり、
Rust IPC、外部bookmark受け渡し、配布用profileを含む試験ではない。
この試験は128 GB Mac上のローカルad-hoc sandboxとhelper単体に限る。外部bookmark付きnon-streaming IPC、
実外部ディスク切断、TestFlightのproduction profile / App Group / Background Assetsは未受入。
2026-09-23の呼出し元監査では、現行の製品画面はstreamingコマンドだけを呼ぶ。
non-streamingコマンドと旧`useAppleAssistCandidate` hookは残るが、後者に製品画面からの呼出しはない。
Rustの両生成経路は共通の`prepare_helper_model_access`を、Swift helperの両actionは共通の
`ScopedModelFolder`を使う。これはsource上の権限処理の共通性であり、実行成功の証拠ではない。
署名済み候補の通常生成を合格判定するには、同じ候補でnon-streaming IPCを実行する手段も必要。
更新後のfrontend 2702件、scripts 31件、型検査、Vite build、App Store surface 132件は成功。
後続で通常生成IPCのhelper待機をblocking workerへ移し、Tauriの同期コマンドによるUI停止を避けた。
Rust全体473件pass / 3 ignored、最終調整後の関連80件pass、`npm run build`と元bundle IDの
1280×820起動smokeが成功。その後、選択済みCore AIモデル行から固定短文だけで
non-streaming IPCを実行する導線を追加した。元文書は渡さず変更しない。request ID付きの
予約・取消をnormal経路にも通し、画面終了時に停止する。応答モデル照合と空出力拒否を行う。
取消前dispatch、実行中取消、正常完了、切替後の古い結果消去を回帰テストで確認した。
frontend 2708件、scripts 31件、Rust 477件pass / 3 ignored、App Store surface 132件、
型検査、Vite build、Rust fmtが成功。fixtureの結果表示は実外部bookmark生成の証拠ではない。
このsourceの`npm run build`も成功し、元bundle IDのプレビュー`.app`はmacOSで
1153×739の表示窓まで起動した。固定例文の実モデル生成は行っていない。

## 署名済み候補の残ゲート

App Groupを含むmacOS配布用profileとApple Distribution / Installer identityを通常のmacOS
権限で確認した。旧UIのclean source `6e76b443`からbuild 149、修正後のclean source
`df33a65a`から3.1.0 build 151の署名済みpkgを作成した。後者は候補作成ツールのApp Store
surface smoke、app / extensionのbuild番号151一致、appと3 helperの署名・entitlement、
pkg署名、SHA-256一致を通常macOS権限で確認。現行候補のパスとdigestはignoredの
`docs/internal/app-store-candidates/latest.json`を正本とする。制限付きshellの信頼評価は
`untrusted`と出たが、通常macOS権限では署名検証が成功した。
通常生成IPCの変更を含むclean source `76d38284`からbuild 152を作成し、旧build 151を
置き換えた。候補作成ツールでApp Store surface 132件、app / extensionのbuild番号152一致、
app・helper・pkg署名、SHA-256一致を確認した。候補メタデータはビルド前のsource cleanを記録。
build 152には後続の製品画面からの通常生成試用が含まれないため、同一候補受入には
このsourceから新しい署名済み候補を作る必要がある。

build 149の配布用profileを埋め込んだ`.app`をローカルから直接起動すると、macOSはproduction profileを
ローカル実行用と認めず、`No matching profile found`として拒否した。これはpkgの署名・形状検証と
別のゲートであり、build 151でも配布形状での外部フォルダ実操作やApple配信取得を確認できていない。
App Store Connectへのupload・Apple側の処理・TestFlight installは未実施。同じpkgをTestFlightで
インストールした後、次を確認する。

1. 外部フォルダ登録・選択後、通常生成とstreaming生成が成功し、元ファイルが変わらない。
2. アプリとhelperの完全終了後、フォルダを選び直さず選択を復元して生成できる。
3. 取消・モデル切替・再生成で、権限不足や旧モデルの取り違えが起きない。
4. フォルダ移動・外部ディスク切断を説明し、登録を残したまま再指定で復帰できる。
5. 選択中の登録を解除しても元のモデルフォルダが残る。
