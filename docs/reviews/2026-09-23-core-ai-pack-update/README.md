# Core AI pack更新とモデル設定の表示確認

Status: source / fixture / 隔離ad-hoc sandbox確認。実Background Assets・TestFlight受入ではない。
Date: 2026-09-23

## 対象

- 同じasset pack IDで互換な新versionを取得する。旧版が利用可能でも最新版の取得完了まで検証しない。
- pack内manifestのmodel ID、runtime kind、schema、サイズ・path・全SHA-256を確認する。
- 選択中modelの更新が検証された後、helperのpathも新版へ切り替える。生成中なら監視して再試行する。
- 初回配布catalogは12Bのみ（最低16 GB・推奨24 GB）とし、設定画面では状態・操作・容量を読みやすくする。

## 表示fixture

`./node_modules/.bin/vite --host 127.0.0.1 --port 1420`で起動し、
`fixture.html`を開く。`?ready=1&theme=dark`は12Bを利用可能にしたダーク表示。
IPCは模擬であり、実際のダウンロード・削除・生成はしない。現行fixtureは12Bのみ・
最低16 GB/推奨24 GB・検証失敗時の「削除して再取得」を表示する。ブラウザーの
アクセシビリティツリーで、E4B行がなく、12Bの情報と復旧操作が見えることを確認した。

以下のPNGは**方針変更前**のE4B/12B表示を撮った履歴画像であり、現行fixtureの見た目ではない。

- [変更前の失敗表示](01-models-ja-recovery.png): 12Bで再試行と削除を別々に出していた。現行は一つの復旧操作に変更。
- [利用可能時の更新確認](02-models-ja-ready-dark.png): 「更新を確認」と選択操作を分ける。
- [600px幅](03-models-ja-narrow.png): 操作ボタンはカード本文の下へ移り、横にはみ出さない。

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
この試験は128 GB Mac上のローカルad-hoc sandboxに限る。non-streaming IPC、生成中の取消・切替、
実外部ディスク切断、TestFlightのproduction profile / App Group / Background Assetsは未受入。
更新後のfrontend 2702件、scripts 31件、型検査、Vite build、App Store surface 132件は成功。

## 署名済み候補の残ゲート

App Groupを含むmacOS配布用profileとApple Distribution / Installer identityを通常のmacOS
権限で確認した。旧UIのclean source `6e76b443`からbuild 149、修正後のclean source
`df33a65a`から3.1.0 build 151の署名済みpkgを作成した。後者は候補作成ツールのApp Store
surface smoke、app / extensionのbuild番号151一致、appと3 helperの署名・entitlement、
pkg署名、SHA-256一致を通常macOS権限で確認。現行候補のパスとdigestはignoredの
`docs/internal/app-store-candidates/latest.json`を正本とする。制限付きshellの信頼評価は
`untrusted`と出たが、通常macOS権限では署名検証が成功した。

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
