# Core AI pack更新とモデル設定の表示確認

Status: source / fixture確認。実Background Assets・TestFlight受入ではない。
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

## 署名済み候補の残ゲート

現地の配布用provisioning profileに必要なApp Groupが含まれず、有効なcodesigning identityもないため、
同じ署名済みsandbox候補を作成できなかった。ad-hocのsandbox署名形状は検証したが、実フォルダへの
権限受け渡しは証明していない。更新したprofileとApple Distribution identityを用意した後、
同一候補で次を確認する。

1. 外部フォルダ登録・選択後、通常生成とstreaming生成が成功し、元ファイルが変わらない。
2. アプリとhelperの完全終了後、フォルダを選び直さず選択を復元して生成できる。
3. 取消・モデル切替・再生成で、権限不足や旧モデルの取り違えが起きない。
4. フォルダ移動・外部ディスク切断を説明し、登録を残したまま再指定で復帰できる。
5. 選択中の登録を解除しても元のモデルフォルダが残る。
