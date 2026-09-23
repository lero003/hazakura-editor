# Current Work

Status: Operational
Scope: v3.1開発キューとv3.0公開後の記録
Authority: High
Last reviewed: 2026-09-23

## 3.1初回配布と外部レビュー是正（2026-09-23、source検証中）

初回のApple配信catalogはGemma 4 12Bだけにする。最低メモリ16 GB、推奨24 GBを表示し、
E4B v2は生成資産・評価履歴を残すがアプリの配布一覧には出さない。以下の旧記録にある
「E4Bを取得対象にした」は、その時点のsource状態であり現行方針ではない。

外部レビューのP2-01〜03に対し、検証失敗時の「削除して再取得」、検証記録のpack version・
ファイル実体への結合、監視世代の確認と状態反映の一体化を追加した。Rustは取得失敗と検証失敗を
別コードで返し、復旧操作はApple資産の削除後に再取得する。再取得で修復しない配布物の不整合は
manifest検証を緩めず失敗として残す。同サイズでmtimeを戻した改変、pack version変更、
旧監視の遅延完了、削除→取得→再検証を回帰テストで固定した。

外部フォルダは本体の永続bookmarkをhelperへそのまま渡さず、利用時に本体でscopeを復元して
一時的なimplicit bookmarkを生成・送信する。`.aimodel`単体選択では親の権限を仮定せず、
resource rootの選び直しを促す。署名済みsandboxでの通常/streaming生成、再起動復元、
取消・切替、移動・切断、登録解除の同一候補受入は引き続き未実施。
clean source `6e76b443`から署名済み3.1.0 build 149 pkgを作成し、app / extension /
helperのentitlementとpkg署名・SHA-256を確認した。配布用profileのため`.app`単体の
ローカル起動はmacOSが拒否する。TestFlight installと上記受入は未実施。
その後、隔離ad-hoc sandboxでは外部E4B v2の登録・選択・再起動復元・streaming生成を実操作で確認した。
`external_local`の選択ボタン欠落を修正し、起動直後のnative probe競合による一時`busy`は
限定再試行する。試験用cloneを移動すると失効表示・再起動後System復帰となり、移動先を
再登録・選択すると生成が復帰した。元フォルダ15ファイルのSHA-256は不変。
最終sourceの隔離プレビューでは3,600字のstreaming生成を途中で停止し、本文不変更の案内を確認。
その後Apple Intelligenceへ切り替え、E4Bへ戻すと利用可となり、再生成がDiff提案まで完了した。
別の3,600字生成中はモデル選択が無効、停止後は再び選択可能だった。通常生成は実E4B v2を
Core AI helper単体へ渡し、通常macOS権限で校正候補を取得した（外部bookmark経路は通していない）。
build 149はこのUI修正を含まない。修正コミット`df33a65a`のclean sourceからbuild 151署名pkgを
作成し、app / extensionのbuild番号、署名、pkg digestを通常macOS権限で確認した。
同一配布候補のTestFlight受入は残る。[build 151と残ゲート](reviews/2026-09-23-core-ai-pack-update/README.md)。

## `npm run build` の起動クラッシュ（2026-09-23、ローカル修正）

従来のApp Store ad-hocプレビューは、起動時のモデル状態更新から
`BAAssetPackManager.sharedManager`へ入り、macOS 27で`SIGTRAP`終了した。別bundle IDへ複製しても
再現し、親appとextensionのbuild番号を揃えても変わらなかった。プレビュービルドだけ専用の
Background Assets transportへ切り替え、Apple配信モデルを「このプレビューでは取得できません」と
表示する。submitビルドは従来のplatform transportを使う。修正後の`npm run build`は成功し、
同じ生成物の別IDコピーを起動して1280×820の表示窓を確認した。後続の`npm run build`では
元のbundle IDも`open -n`で起動し、ウィンドウ表示を確認した。
Apple配信モデル取得、署名済みTestFlightの動作はこのsmokeの範囲外。frontend 2698件、
scripts 31件、Rust 473件pass / 3件ignored、App Store surface 132件、型検査、
distribution probe、Rust fmt、diff checkは成功。

## C-3 外部モデルフォルダとLocal Assist導線（2026-09-23、source接続）

Local Assistのモデル選択メニューからオンデバイスモデル管理へ進める。管理画面では標準フォルダ選択で
Core AI resource folderを登録し、検証済みモデルを既存の単一registryから選択できる。
外部フォルダの権限はread-only security-scoped bookmarkを保存し、Rustと生成helperの各プロセスで
解決する。登録解除は元ファイルを削除せず、選択中ならSystemへ戻す。失効・破損した登録は理由付きで
一覧に残す。任意URL取得・GGUF・自動ダウンロードは追加していない。

sourceの型検査、契約テスト、helper fixtureだけでは実モデルのロード・署名済みsandboxでの権限継承を
証明しない。隔離ad-hoc sandboxでの実操作結果は上記を参照。同一配布候補では登録→選択→生成→
再起動→復元→登録解除と失効時の再指定をまだ受け入れていない。
Local Assistのキーボード/VoiceOver、Custom Modelsフォルダを開く導線も残る。
確認した範囲はfrontend全体と追加したfocusedテスト、Rust 467件pass / 3件ignored、Swift
XCTest 66件 + Swift Testing 4件、型検査、Vite build、App Store surface 132件、配布用helper build。
bookmark実登録の単体テストは制限付き実行環境で`Operation not permitted`となり、上の実機ゲートへ残す。
App Store sandboxプレビューではCore AI helperも`com.apple.security.inherit`で再署名するよう
smokeを修正し、3 helperと親アプリのad-hoc署名検証を通した。実フォルダを読めることの証明ではない。
後続の隔離ad-hoc sandbox実操作で外部E4Bの読取・streaming生成まで確認した（冒頭の記録）。

## Core AI pack更新とモデル設定（2026-09-23、source検証済み）

build 147では12Bのpack versionがv2に変わっても、アプリに固定した旧resource manifest全文との
不一致で失敗する実機報告があった。旧E4B v1を入れて削除したMacで、E4B v2が「未公開」、
12Bは再試行後も失敗と表示された。sourceではE4B v2の配信フラグを有効にし、12Bとともに
同一asset pack IDの互換版更新を明示的に確認できるよう変更中。Appleの最新版取得が完了するまで
旧版pathを`Ready`検証へ進めず、pack内manifestのidentity / runtime kind、safe path、
size / SHA-256を検証する。選択中モデルは新pack検証後にhelperのpathも切り替え、生成中は
切り替え可能になるまで監視を続ける。モデル設定は状態・操作・容量をカードに分け、内部エラーと版情報を
折りたたみへ移し、失敗時の再試行 / 削除、利用可能時の更新確認を示す。
旧build 147の挙動はこのsource変更だけでは変わらず、新しいアプリbuildの配布が一度必要。
その後の互換pack更新は同じIDとruntime契約ならアプリ更新なしで取得できる設計。
Apple CDN、対象Mac、TestFlight、VoiceOverによる受入は未実施。
Rust 465件pass / 2 ignored、frontend全体・モデル画面focused・App Store surface、
型検査、Vite build、macOS 27 SDKでのnative bridgeコンパイル、通常幅 / 600px幅 / dark fixture表示が成功。
[表示fixtureと検証範囲](reviews/2026-09-23-core-ai-pack-update/README.md)。

## Core AI E4B v2 候補（2026-09-23）

旧E4Bの日本語崩れはstatic PLE graphで再現し、元QAT checkpointのeager実行、
PLEだけint8化したeager実行、provider型Core AI graphでは再現しなかった。static graphは
decoderをfp16へ戻しても崩れたため、decoder量子化だけが原因という仮説は棄却。
固定checkpointからsymmetric int4 decoderとper-token PLEテーブルを再変換し、元重み・
ツール・出力ファイルをpinした。`coreai-kit-gemma4-ple-provider`をRust/Swiftの契約へ追加し、
寸法・ファイル長を確認してからmmapするhelper patchを配布buildへ組み込んだ。

v2の実helper / stageで日本語・Markdown・引用の6例×3回と取消後の再依頼が全件成功。
校正時の漢数字→算用数字変換は候補採用前に元文へ戻す。`.aar`はローカル生成済み。
オーナーはv2のTestFlight配信成功を報告したが、この作業ではApple側を独立確認していない。
build 146のアプリ本体は旧v1を参照した。現在のsourceではv2を明示取得対象へ変更した（上記）。
16 GB実機のmemory/品質、AOT、v2を参照する新アプリbuildでの取得・生成を別ゲートで受け入れる。
編集promptを外したE4B v2 / 12Bの短い直接会話は
[会話probe](reviews/2026-09-23-core-ai-direct-chat/README.md)で確認済み（編集品質の合格ではない）。

同じ校正対象で参考文脈だけを変えた[文脈probe](reviews/2026-09-23-core-ai-context-probe/README.md)では、
参考文脈中の「青い栞を赤い栞に変更」という命令をE4B v2 / 12Bとも生出力へ取り込んだ。
短い入力でも起き、単なる文字数問題ではない。8,000字文脈は両モデルで生成エラーになった。
校正9件を文脈あり/なしでE4B v2・12B・Systemに通し、各9組で候補が一致し保持チェックも通った。
初回校正では文脈を送らず、追加依頼では固定原文と依頼履歴を残し、隣接本文だけ省く。
他の操作・固定prompt・samplerは変更しない。実原稿/実機品質と他操作の文脈量は未受入。

## 実機フィードバック対応（2026-09-22）

Local Assistの文字サイズを一段縮小し、「再確認」をモデル選択時の自動probeと上部の短い状態表示へ変更。
同じモデルの選び直しでも再probeし、会話・入力は保持する。frontend 2,686件、scripts 24件、
surface 132件、型検査、Vite、ブラウザー表示確認は成功。E4Bは固定18件で文章崩れを再現し、
前回保存結果とraw / candidateが全件一致。表示後処理の問題ではないが、モデル / runtimeの原因は未確定。
**機械チェック成功を文章品質の合格としない。** 次はユーザーの再現例と旧版を固定し、token列のdecodeと
promptを分離比較する。[証跡と残課題](reviews/2026-09-22-assist-device-feedback/README.md)。

## 審査・掲載文の準備（2026-09-22）

[3.1掲載文パケット](releases/3.1.0-app-store-listing-copy.md)に日本語説明・副題・画像案をまとめ、
[リリースノート](releases/3.1.0-app-store-release-notes.md)に日英What's New、英語App Review Notes、
TestFlight確認項目を整理した。英語JSONも3.1へ更新、全て未適用の草案。
`8dffa835`からの署名pkg作成は別途成功したが、Apple側送信・実機受入・審査は未実施。
候補情報はGit対象外の`docs/internal/app-store-candidates/latest.json`を参照する。
次は同じ候補の実機確認と出荷範囲決定。Core AI配信の告知は配信・品質受入後だけ採用する。

## モデル設定・切替の自己レビュー（2026-09-22）

設定とAssist pickerのlocal選択条件を統一し、選択中local folder消失時もSystemへ戻せるようにした。
設定の「使う」が消えた後は同じモデル行へfocusを戻し、別操作へ移動済みなら奪わない。
再レビュー（`36b7842a`）のP2/P3として、通常テーマのモデル行focus枠と消失localの3言語表示も修正。
保存先・配布状況の旧説明も3言語で修正。frontend 2,686件、scripts 24件、surface 132件、型検査、
App Store preview buildとdistribution probeはローカルで成功（CIの独立確認ではない）。
3.1.0のローカルad-hoc previewを再作成した。
次はオーナー実機レビュー。操作項目と証跡は
[モデル設定自己レビュー](reviews/2026-09-22-model-settings-self-review/README.md)。
VoiceOver、実モデルmemory、sandbox / TestFlightは未確認。

## C-3 再レビュー追加是正 — cache解放順序とTokenizer null契約（2026-09-22）

前回4件のクローズ確認後に見つかった追加P2/P3を `a7d19487` で閉じた。

- **P2（再ロード時の旧モデル保持）:** cache hit / miss / invalidationをCore AI型から独立した
  `CoreAIModelCacheStorage` へ抽出した。署名不一致または署名取得不能では、重いmodel factoryを
  開始する前に旧entryを解放する。同一署名だけを再利用し、replacement loadが失敗しても旧entryを
  保持し直さない。production / app-managed local の両経路が同じ関数を使う。
- **P3（`embedded_tokenizer: null`）:** 既定値trueはfield省略時だけに限定した。明示`true`は受理、
  `false`は`external-tokenizer-not-allowed`、`null`と型不正は`malformed-bundle-metadata`で、
  Rust / Swift共通35ケースfixtureに固定した。

回帰テストはダミーmodelとfactoryを使い、同一署名ではfactoryを再実行しないこと、署名不一致と
取得不能ではfactory開始前に旧参照が外れること、replacement失敗後も旧参照が残らないことを確認した。
検証は frontend 2,677件、scripts 24件、Rust 456件（2 ignored）、Swift XCTest 61件 +
Swift Testing 4件、App Store surface 132件、型検査、Vite build、Rust fmt、production Core AI
distribution helper build、`git diff --check` が成功。**実local modelでのmemory / swap測定、実load / 生成、
built app、VoiceOver / キーボード、TestFlightは未確認**。次は
[同じ外部レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)で再レビューする。

## C-3 複数スライス外部レビュー是正（2026-09-22）

スライス1〜3への外部レビュー P1/P2/P3 を `2fd9df12` で閉じた。local contract はbundle
`metadata.json` のloader必須fieldをRust / Swift双方で読み、`assets.main` がbundle内の安全な
pathで、検証済みの単一 `.aimodel` と完全一致する場合だけreadyにする。`../`、途中symlink、
別のnested model参照を共有fixtureで拒否する。

`language.embedded_tokenizer=false` は `external-tokenizer-not-allowed` としてloader生成前に拒否し、
local modelがHugging Face tokenizer fallbackへ進まないよう固定した。cache identityにはbundleと
`.aimodel` の両metadata、tokenizer本体とloaderが読む補助設定、その非存在をcontent identityとして
追加した。大きなpayload / tablesはsizeに加えて秒未満mtimeとfile identityを見る。
`layout.bundle` / `decoder` / `tables` は欠落を `missing-bundle-directory`、空文字を `unsafe-path` に
Rust / Swiftで統一した。共有fixtureは31ケース。

検証は frontend 2,677件、scripts 24件、Rust 456件（2 ignored）、Swift 61件、App Store surface
132件、型検査、Vite build、Rust fmt、production Core AI distribution helper build、
`git diff --check` が成功。**実 local modelのload / 生成、built app、VoiceOver / キーボード、
TestFlightは未確認**。次は同じ[外部レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)
で再レビューし、指摘を閉じてからexternal local sourceのbookmark / helper権限境界へ進む。

## C-3 Custom Models を選択・helper 実行経路へ接続（2026-09-22）

C-3 スライス3として、スライス1/2で検証・一覧表示まで進めた app-managed local model を、
既存 Local Assist の選択・availability probe・通常生成・streaming 生成へ接続した。

- Rust は `local:app-managed:<directory-name>` から path を組み立てず、選択時と再起動復元時に
  `CoreAICustomModels` を再走査し、同じ ID の**検証済み候補**だけを canonical root として採用する。
- helper wire に `core_ai_local` を追加した。Swift は `CoreAILocalResourceContract` を再実行してから
  `CoreAIKit` の `KitGemmaModel` / `KitLanguageModel` へ渡す。Apple-hosted 用の licence / notice /
  signed manifest 契約は緩めていない。
- local model は production と同じ prompt / generation profile / Proposal → Diff → 明示 Apply 経路を使う。
  キャッシュは上記レビュー是正後のmetadata / tokenizer設定 / payload identityで同一性を確認し、
  署名を作れない場合は request ごとに fresh load する。
- 選択は Rust-owned ID だけを永続化する。再起動時に bundle が消えた、または壊れた場合は System へ
  fail closed し、保存値も修復する。生成中の切替拒否と保存失敗時の旧 backend 維持は既存契約を再利用する。
- UI は `detected` な local model にだけ「使う」を出す。download / cancel / retry / delete は引き続き
  Apple-hosted 専用で、壊れた local candidate は理由表示だけに留める。

検証は frontend 2,676件、scripts 24件、Rust 456件（2 ignored）、Swift 59件、App Store surface
132件、型検査、Vite build、Rust fmt、production Core AI distribution helper build、
`git diff --check` が成功。distribution build は `COREAI_PRODUCT_BACKEND` の型接続を確認したが、
**このスライスでは実 local model の load / 生成、built app、VoiceOver / キーボード、TestFlight は未確認**。

スライス1〜3をまとめた[外部レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)を
用意した。次の実装ゲートは外部 resource folder の security-scoped bookmark / helper 権限境界で、
Custom Models フォルダを開く / 明示再スキャンする UI も未接続。

## C-3 Custom Models を既存モデル一覧へ統合（2026-09-22）

C-3 スライス2として、`app_data_dir()/CoreAICustomModels` 直下の候補を既存の
`CoreAiModelStore` と「オンデバイスモデル」ページへ接続した。別 registry は作らず、summary に
`source` / `errorCode` と `detected` 状態を追加する。正常な bundle は「ローカル・検出済み」、
壊れた bundle は共通 contract の安定 code を日本語 / 英語 / かなへ変換して表示する。

Apple-hosted の download / select / cancel / delete は `source` で従来どおりに限定し、
ローカル ID は Rust 側でも全管理操作を拒否する。この段階では **検出・表示のみ**で、選択、
helper への path 引き渡し、実生成、外部 resource folder の bookmark、Custom Models フォルダを
開く / 再スキャンする UI は未接続。

検証は frontend 2,676件、scripts 24件、Rust 455件（2 ignored）、App Store surface 132件、
型検査、Vite build、Rust fmt、`git diff --check` が成功。
[証跡](reviews/2026-09-22-v3.1-c3-custom-model-catalog/README.md)。次のゲートは helper の
ローカル backend と権限境界を固定し、選択・生成へ接続するスライス。

## C-3 外部レビュー是正 — ローカル契約の分離と symlink / scan（2026-09-22）

スライス1への外部レビュー P1/P2 を閉じた。P1 は「Rust の検証が helper の契約と一致する」と
いう主張の誤りで、production helper は licence / notice / `expectedModelId` 一致まで要求し、
`hazakura-model.json` の無い bare language bundle も受理しない。訂正として production 契約へ
寄せるのではなく、**ローカル用 contract を分離**した。

- Swift に `CoreAILocalResourceContract` を追加し、Rust の `core_ai_local_models` と同じルールで
  bare language resource / Hazakura記述 local resource を検証する。
- `src-tauri/resources/core-ai/local-model-contract-cases.json` を共通 fixture spec とし、
  Rust（`include_str!`）と Swift（`#filePath` から探索）の両テストが同じ20ケースを通す。
  片側だけ変えるともう片方が落ちる。
- production 契約が licence を要求し、local 契約が licence なしで ready になることを Swift の
  回帰テストで固定した。
- symlink は最終要素だけでなく、root から対象までの**全 component** を拒否する。
  tokenizer ディレクトリ symlink、`layout` ディレクトリ symlink、bundle 内から外を指す
  symlink を拒否するテストを追加。
- Custom Models scan は symlink 候補と種別不明の候補を resolver へ渡し、`unsafe-path` /
  `unreadable` として報告する（黙って消さない）。
- descriptor の read 失敗は `unreadable`、JSON parse 失敗は `malformed-descriptor` に分離。

検証は `cargo fmt --check`、`cargo test`（452 passed / 2 ignored、モジュール内25件）、
`swift test`（57 passed、新規5件）。Swift は Codex seatbelt 内で module cache を作れないため
sandbox 外で実行した。後続のスライス2で app-managed の保存場所と検出表示、スライス3で
ローカル backend の選択・生成経路まで接続した。**外部 bookmark は引き続き次のゲート**。
[証跡](reviews/2026-09-22-v3.1-c3-local-contract-followup/README.md)。

## C-3 ローカルモデル解決・検証層（2026-09-22）

v3.1 追加レーン C-3 の1本目のスライス。Apple-hosted 以外のモデルソースを扱う前に、
ローカル bundle の解決と構造検証を Rust へ追加した。`resolve_local_model_root` は
resource root / language bundle / `*.aimodel` 指定を受け、`metadata.json`、
`tokenizer/tokenizer.json`、単一の `*.aimodel`（`metadata.json` / `main.hash` /
`main.mlirb`）を必須にする。`hazakura-model.json` がある場合は `schemaVersion` /
`modelId` / `runtimeKind` / `layout` を読み、`gemma4-ple` では embedding tables も
必須。symlink、bundle 外の `layout`、`..` は安全側で拒否する。
`scan_custom_models_directory` は直下の候補を解決し、壊れた候補も理由付きで返す。

これは**この時点では検証層のみ**で、catalog / IPC / UI へは未接続だった。ユーザー向け文言は frontend が
所有する前提で、エラーは `missing-tokenizer` などの安定 `code` を持つ。
`cargo fmt --check`、`cargo test --manifest-path src-tauri/Cargo.toml`（447 passed /
2 ignored、新規20件）は成功。当時の次ゲートだった store / IPC / UI のうち、app-managed の
検出表示は上記スライス2で接続済み。security-scoped bookmark と helper の権限境界は未確定。
[証跡](reviews/2026-09-22-v3.1-c3-local-model-resolution/README.md)。

## TestFlight前 外部レビュー6件の追補（2026-09-22）

`aac6e900`へのP2 6件を閉じた。streaming marker prefixをbufferして最後のraw snapshotだけを
最終採用し、設定とLocal Assist窓のmodel catalog同期を共通化してevent後の古い操作応答を捨てる。
Background Assetsはserial queue + 操作世代でmanifest解決中cancel/retryを無効化し、paused monitorは
低頻度で継続する。選択中modelの削除失敗は旧選択を復元し、失敗時も実catalogをemitする。
model pickerは進捗更新でfocusを奪わない。

設定には現在model / 物理メモリ、ready前の「インストール後」サイズ、正直なSystem状態、削除確認を
追加し、「直近の生成記録」を既定で閉じた。ローカルの全frontend 2,674件、scripts 24件、Rust
427件（2 ignored）、Swift 52件、surface 132件、型検査、Vite build、App Store preview buildは成功。
実装commit `a16b0971`のPR #52 Quality run `35664620124`はfrontend / nativeとも成功し、
merge stateは`CLEAN`。PRの最新check-runはGitHubを正本とする。次のゲートは外部再レビュー。
その後にbuilt appのキーボード/VoiceOver、sleep/wake、実Background Assets、
32 GB機Internal TestFlightを行う。
外部再レビュー後、2026-09-22に同じ全ゲートをローカルで再実行して同じ結果を確認し、
PR #52は`e18c102d`時点のQuality run `35665281992`もfrontend / nativeとも成功した。
Swift helperのbuild / testはCodex seatbelt内でmodule cacheを作れないためsandbox外で実行した。
証跡commit `325833fb`のQuality run `35670541634`はfrontend / nativeとも成功し、
merge stateは`CLEAN`。マージ前に最新HEADのcheck-runをGitHubで確認する。
[追補証跡](reviews/2026-09-22-testflight-review-followup/README.md)。

## Core AI 12B catalog・配布UX・出力復元（2026-09-22）

App Storeレーンの固定catalogへGemma 4 12Bを追加し、E4Bと同じApple-hosted managed
download / 検証 / 選択 / 削除経路へ接続した。Developerレーンのproduction catalogは空のまま。
任意URL/path、ローカルimport、cloud fallback、自動download、auto-applyは追加していない。

- 設定のオンデバイスモデルページにdownload量、展開後使用量、推奨メモリ、license要約を表示。
  Rustが`hw.memsize`を読み、推奨値未満では開始前に確認する（禁止はしない）。12Bは変換元の
  license原文もpayloadへ保持することを明示する。
- モデル状態は「購読 → snapshot」にし、snapshot取得中に届いた新しい進捗を古い結果で
  巻き戻さない。購読失敗時もsnapshot取得は続ける。
- 12Bが復唱する完全な外側`HAZAKURA_TEXT` envelopeだけを候補整形で除去する。原稿自身が
  markerを含む場合、前後に別テキストがある場合、不完全な内側markerは残す。stream途中の
  未完envelopeはUIへ出さない。
- macOS 27専用Background Assets selectorをSDK compile guardへ入れ、CIのmacOS 26 SDKでも
  fallback側をコンパイルできるようにした。実際のmacOS 26 SDKでの確認はPR CIを正本とする。

ローカル12B archiveは9,148,924,300 bytes、SHA-256
`208bc19246665964a6fb910503ee1e2e20ff4830d378901d9a651a50837a10eb`。production helperで
18 fixtureを実行し、変更前は14/18で内部markerだけが失敗、変更後は18/18ですべての機械checkが
通った。これはM4 Max / 128 GBのローカル実行証跡であり、32 GB対象機、Apple upload / processing、
CDN materialization、TestFlight、VoiceOverの証跡ではない。

検証はfrontend 298 files / 2,666件、project script 24件、Rust 424件（2 ignored）、Swift 49件、
App Store surface 131件、型検査、Rust format、Vite build、ad-hoc App Store preview build、
1200 x 820 / 640 x 820のVite fixture目視。PR #52のQuality run `35655597653`はfrontend / native
ともに成功し、macOS 26 SDK guardも実証済み。次のゲートは外部レビュー、その後に
12B archive upload / processingと32 GB対象機のInternal TestFlight受入。
[外部レビュー用証跡](reviews/2026-09-22-core-ai-12b-catalog/README.md)。

## 外部レビュー2巡目 — 見出し着地後の Tab とかなラベル（2026-09-21）

`540affc7` への指摘 P2 1件・P3 1件を閉じた。P1 は指摘なし。

- **P2（フォーカストラップとの噛み合わせ）:** ページ見出しは `tabIndex={-1}` のため
  `getFocusableElements()` の一覧に入らない。トラップが「一覧に無い」を「ダイアログ外」と
  同じ扱いにしていたので、着地直後の Tab がヘッダーの選択へ戻り、Shift+Tab が本文の最後へ
  飛んでいた。一覧に無い場合を **ダイアログ内の受け皿** と **ダイアログ外** に分け、
  前者はその DOM 位置から前後へ進める（端では従来どおり折り返す）。ダイアログ外の扱いは不変。
- **P3:** かなメニューの「おんでばいますもでる...」を「おんでばいすもでる...」へ訂正。

回帰テストは unit（`focusTrap.test.ts`）に加え、**実際の `PreferencesDialog` +
`useModalKeyboardGuard`** の組み合わせで「見出しへ着地 → Tab / Shift+Tab」まで見る
`OnDeviceModelsPane.keyboard.test.tsx` を追加した。分岐を旧挙動へ戻すとこの2件が落ちることを
確認済み（red → green）。検証は Rust 424件（2 ignored）、frontend 298 files / 2,662件、
project script 24件、型検査、Vite build。

**マージ手順の訂正:** `gh pr merge --match-head-commit` は HEAD 一致のガードで
fast-forward 指定ではない。SHA を保った厳密な FF-only が要る場合はローカルで
`git merge --ff-only` して `main` を push する（このブランチは `main` の直系）。
証跡は [外部レビュー追補](reviews/2026-09-21-review-followup-models-page/README.md)。

## 外部レビュー追補 — 遷移フォーカス・購読競合・メニュー入口（2026-09-21）

外部レビューの P2 2件を閉じ、同時に「設定から独立したシステムメニューの入口」を足した
（P1 は指摘なし。独立ページ化と値の出所は不変）。

- **P2-01（遷移フォーカス）:** 設定本文の入口は切替でボタンごと消えるため、
  フォーカスが `body` へ落ちていた。`OnDeviceModelsPane` の見出しを `tabIndex={-1}` の
  受け皿にし、ヘッダー外から来たときだけ見出しへ移す。ヘッダーの選択で来たときは
  選択にフォーカスを残す。
- **P2-02（購読競合）:** `CoreAiGenerationProfile` を「購読 → スナップショット」の順に変え、
  取得中に通知が届いたら取得結果を採用しない（`generation` で判定）。通知の取り逃しと
  古い値の巻き戻しの両方を回帰テストで固定した。
- **システムメニュー:** `MENU_ON_DEVICE_MODELS`（`on-device-models`）を追加。macOS は
  アプリメニューの「設定...」の隣、他 OS は File の隣。設定本文を経由せずモデルページを
  直接開く。lane 制限なし、かなラベルも追加。

検証は Rust 424件（2 ignored）、frontend 297 files / 2,659件、project script 24件、
App Store surface 130件、型検査、Vite build、App Store preview レーンの `npm run build`。
両修正とも、外すと新規テストが落ちることを確認済み（red → green）。
**CI はこのブランチでは走らない**（`quality.yml` は `pull_request` と `main` push のみ）。
built app でのメニュー実表示・フォーカス、VoiceOver、最大 Dynamic Type は未実施。
証跡は [外部レビュー追補](reviews/2026-09-21-review-followup-models-page/README.md)。

## オンデバイスモデルを独立ページにする（2026-09-21）

モデル管理を Preferences 内の1ペインから独立ページ（`models` モード）へ移した。
設定本文（アプリケーション）には入口の1行だけを残し、押すと同じダイアログの
モデルページへ切り替える。ページはモデル一覧（状態・サイズ・資産バージョン・
  開始/進捗/再開/取消/削除/選択）、保存先の説明、直近の生成記録、
扱えるモデルの境界を1か所にまとめる。選択中でもサイズ・バージョンを落とさない。

保存先は Apple-hosted asset pack がプロセス単位で決めるため、選ばせず説明だけを出す。
自動ダウンロード・起動時スキャンは足していない（明示操作の境界は不変）。
Rust の command 契約と helper へ渡す内容も不変で、変更は frontend / CSS / docs。

検証は frontend 297 files / 2,654件、project script 24件、App Store surface 130件、
型検査、Vite build、Vite fixture での実表示（日本語 light / 英語 dark / 未配布の空状態）。
**built app（WKWebView）と VoiceOver・最大 Dynamic Type は未実施**。2026-09-22にlicense要約と
展開後使用量を追加済み（notice本文を開くUIは未実装）。証跡は
[オンデバイスモデルの独立ページ](reviews/2026-09-21-on-device-models-page/README.md)。

## Core AI 生成設定の可視化（2026-09-21）

前スライスの `usage`（要求した設定と実効設定）を設定画面から見えるようにした。
値を webview や設定側にもう一度書くと、配線が変わっても画面だけ正しく見えてしまうため、
表示は helper → Rust の記録だけを読む。設定のオンデバイスモデル欄に
「直近の生成記録」（出力上限 / サンプリング要求 / サンプリング実効 /
直近のトークン数 / 直近のモデル）を追加し、まだ Core AI で生成していない起動では
空状態を出す。記録はプロセス内のみで、保存も送信もしない。

モデルへ渡す内容は変えていない（prompt 契約・生成オプション・Apply 経路は同じ）。
検証は Swift helper の distribution ビルド、Rust 422件（2 ignored）、frontend 2,649件、
project script 24件、App Store surface 129件、型検査、Vite build、
App Store preview レーンの `npm run build` まで成功。**実 Core AI での観測は未実施**
（Codex 環境は GPU を渡さないため）。詳細は
[Core AI generation profile surface](reviews/2026-09-21-core-ai-generation-profile/README.md)。

## Core AI E4B 配線の作り込み（2026-09-21）

実機（16 GB MacBook Air）で編集品質が崩れるという報告と外部レビューを受け、
**モデルへ渡す設定・指示・復元**を直した。設定を増やすより前に配線を正す、という順序。

- 追加要望があると落ちていた action 別の基本指示を、追加要望と別項目にした
  （`AssistPrompt.swift`。基本操作 / 変更の範囲 / 追加のご要望 / 対象本文 / 参考文脈）。
  保持規則は操作ごとに違え、System 経路も同じ契約を使う。
- 要求した生成設定とエンジンへ渡った実効設定を usage に分けて記録する
  （`CoreAIGenerationProfile.swift`）。pinned `coreai-kit` の Gemma 実行器は
  `temperature` しか写さないため、top-k / top-p は要求せず、要求した場合は破棄として記録する。
- 停止トークン（`<eos>` 等）は本文中の言及を残しつつ、先頭・末尾だけ落とす
  （`CandidateFormatting.stripOuterControlTokens`）。
- ロード済みモデルを helper 内で再利用する（`CoreAIRuntime.ProductionModelCache`）。
  helper 終了・別モデル/別資源・アイドル（既定 300 秒）で解放し、セッションは毎回新しくする。
- 評価ハーネスに `noControlTokens` と「追加指示なし」fixture 3 件を追加。

検証は Swift 37 件、distribution flavor の `swift build`、frontend / Rust 一式。
**E4B の実生成による再測定は未実施**（Codex 環境が GPU を渡さず `noMetalDevice` になるため）。
オーナーの通常 shell で `scripts/evaluate-local-assist.mjs` を回して秒数と品質を確定する。
詳細と再測定コマンドは [Core AI編集品質（ハーネス）調査メモ](core-ai-harness-quality.md)。
設定画面での実効設定表示は
[Core AI 生成設定の可視化](reviews/2026-09-21-core-ai-generation-profile/README.md)で実装した。
証跡は [Core AI E4B wiring slice](reviews/2026-09-21-core-ai-e4b-wiring/README.md)。

## Core AI 配布前基盤 — TestFlight手前（2026-09-20）

オーナー方針により、App Store / TestFlightレーンにもCore AIの実行adapter、モデル管理、
選択状態を含める。System用helperはmacOS 26互換のまま維持し、Core AIはmacOS 27+
専用の別helperとしてuniversal appへ同梱する。設定にはモデル管理面、Local Assist窓には
利用可能モデルの選択を接続し、Rustだけがapp-privateな選択と検証済みpathを保持する。
frontendから任意path / URL / GGUFを渡す入口、製品内変換、cloud fallbackは追加しない。

2026-09-21に内部TestFlight受入へ進むため、App StoreレーンへGemma 4 E4Bをproduction
catalog接続し、2026-09-22に12Bも同じ固定catalogへ追加した。Developerレーンのproduction
catalogは空のまま。Apple-hosted managed
Background Download extension、`group.dev.hazakura.editor`、3つの`BA*` key、`AssetPackManager`の
download / progress / cancel / resume / remove / restart復元を実装した。G1はmodel-state eventで
SettingsとLocal Assist窓を同期し、G2はsigned manifest、safe path、size、全SHA-256検証後だけ
`Ready`にする。モデルをappへ仮同梱したり、Developer用Qwen fixtureを本番idへ昇格したりしない。

[本番候補とasset準備の正本](core-ai-production-models.md)では、巨大なmodel/archiveを
`.hazakura/coreai-production/`へ生成しGitへ入れない。以前はXcode 27.0 `ba-package`の
拡張子判定不具合として`.aar`作成を保留していたが、この判定は誤りだった。失敗はCodexの
seatbelt sandbox内だけで再現し、通常shellでは同toolが相対/絶対、`-o`/`--output-path`、
default/明示`package`の全てで成功する。manifestも実物の`ba-package template`と照合して有効。
`package`は`sourceRoot`へchdirしてから出力pathを解決するため、絶対pathを渡すよう修正した。
sandbox外でE4B（5,431,767,276 bytes）と12B（9,148,924,300 bytes）の`.aar`を生成済み。
`coreai-build`もなくMac AOT済み`.aimodelc`はまだ作れない。`.aar`のローカル生成成功も
Apple CDN upload、TestFlight取得、品質採用、出荷可能の証跡にはしない。

source側は「E4BのApple CDN取得を要求し、検証後にproduction helperへ渡す」形まで進んだ。
ローカル`.aar`は生成済みで、Apple CDN upload、署名済みbuild、TestFlight取得・helper load、AOT、
16 GB機の日本語bake-off、notice最終確認は未完了。再生成された本体・extension両profileは`OSX`、
Bundle ID、App Group、有効期限をpreflightで通過し、profile内certificateとインストール済みidentityも
一致した。3.1.0 build 143のApple Distribution署名appとInstaller署名pkgを作成し、entitlement probe、
deep verify、`pkgutil --check-signature`を通した。Transporter uploadとApple processingは未実施。
[実装・Apple側handoff・実機手順](reviews/2026-09-21-core-ai-apple-hosted-e4b/README.md)。

最終検証はSwift 24件、Rust 417件（2件ignored）、frontend 2,646件、project script 14件、
App Store surface 129件、型検査、Rust format、Vite build、`npm run build`まで成功。
ローカルad-hoc previewに3 helperとBackground Download extensionが入り、BA設定・App Group・
deep signatureをprobeした。署名済みApp Store pkg / TestFlightではない。

外部レビューP2追補では、Developer明示テスト選択の起動時上書きと、任意機能の
モデル管理エラーが通常起動を止める経路を修正。App Storeはテスト指定を無視し、
管理エラーは設定に保持する。保存失敗時のruntime切替と旧availabilityの残留も修正した。
回帰テストのred→greenと全Rust 411件（2 ignored）、frontend 2,635件、surface 128件を確認。
修正後の`npm run build`とlocal previewのdistribution probeも成功。
TestFlight/CDN受入は引き続き別ゲート（詳細は上の記録）。

再レビューR1 / R2ではprobeのworker移動・生成中即時拒否と、表示言語変更で通知購読を
張り直さない修正を追加。「再確認」は会話を保持し、切替・確認中の送信を止める。
この後の最終値はRust 417件（2 ignored）、frontend 2,646件、surface 129件とbuild / preview probeが成功。
次は遅延probe中の実ウィンドウ応答・停止受入（隔離QAでは起動導線へ到達できず未確認）。
G1 / G2はsource実装と回帰テストまで閉じた。E4B `.aar`はsandbox外の`npm run coreai:models:package`
で生成済みで、署名app/pkg側も準備済み。ただしbuild 143はextension署名がprofileの
`com.apple.application-identifier`を持たずApple 90886でTestFlight不適格になった。
署名scriptはprofile由来のapplication/team identifierをextensionへ署名し、署名後に読み返して
検証するよう修正済み（既存bundleへの再署名とApp Store entitlement probeで確認）。
同一build番号は再uploadできないため、次は差し替えcandidateを作り直し、asset upload / processing、
app build upload、署名済みInternal TestFlightの一本受入を行う。build 144はAppleの処理まで通り、
90886の修正を実証した。asset pack ID変更後の差し替え候補は3.1.0 build 145（未upload）。
`.aar`のTransporter uploadは
App Store Connect側の`-19243`/400で止まっていたが、`altool`で実APIを叩いて原因を特定した。
App Store Connectは`assetPackIdentifier`内のピリオドを拒否するため、E4B/12BのIDを
`hazakura-coreai-gemma4-e4b-v1` / `hazakura-coreai-gemma4-12b-v1`へ変更し、lockの検証で
ピリオドを禁止した。`.aar`は新IDで再生成済み（旧IDの生成物は削除）。
疎通とは別の配布UX候補（メモリ警告、保存先・空き容量、ライセンス表示など）は
[Core AIモデル配布UXバックログ](core-ai-ux-backlog.md)へ分離した。
16 GB機の実機確認で見つかった編集品質の課題は
[Core AI編集品質（ハーネス）調査メモ](core-ai-harness-quality.md)に整理した
（`maximumResponseTokens = 128`、greedy / temperature 0、Qwen用promptの流用が候補）。
外部レビューの3件（整形が原稿の`<eos>`を消す / アイドル解放の既定値が効かない /
キャッシュ署名が`decoder/main.hash`を見ている）は修正済みで、再測定は18 fixture中3件失敗。
残りはbundleの`eos_token`不一致に起因するとみられ、12Bライセンスも調整済み
（`reviewed-apache-2.0`、`.aar`再生成）。次は設定画面の作り込みと実機テスト。

## 3.1.0開発版へ移行・リリースノート着手（2026-09-20）

npm / Tauri / Cargo / lockfileの版を `3.1.0` へ揃えた。これは開発版への移行であり、
署名済み候補、TestFlight提出、App Store申請、GitHubタグ、公開を意味しない。
[3.1.0 App Storeリリースノート草案](releases/3.1.0-app-store-release-notes.md)には、
現時点で実装済みのLocal Assist表示整理と言語・復旧面の改善だけを掲載候補として記載した。

Core AIはDeveloper専用の固定Qwen fixtureを既存Local Assistへ接続し、Phase 1の
Proposal / Diff / 明示Apply / Undo / CancelとSystem復帰まで実機確認した。開始時点では配布版へ
空catalogのadapter・管理・選択基盤を追加し、その後2026-09-21にE4BのApple-hosted source経路、
検証済みReady、削除まで実装した。asset upload、AOT、品質採用は未完了。
海外App StoreもConnect設定・公開Web・署名候補の英語受け入れが未完了で、これらは
実装・受入後に草案へ追記する。
`src-tauri/tauri.conf.appstore.json` のbundleVersion変更は本作業と並行する既存変更として保持し、
署名候補を作るまで3.1.0のbuild証跡には採用しない。

## Core AI Phase 1 — 固定Qwen fixture配管（2026-09-20）

`HAZAKURA_LOCAL_ASSIST_TEST_BACKEND=core_ai_test` をRust/native側だけで解釈し、固定の
`.hazakura/coreai-test/exports/hazakura-qwen3-0.6b-test/` をCore AIへ渡すDeveloper経路を追加。
TypeScriptからbackend / path / model id / URLを渡す入口、製品内変換・取得、Systemへの自動fallbackは
追加していない。このDeveloper fixture自体は通常build / App Store buildへ含めない。
後続の配布前基盤では、固定fixtureとは別のCore AI production adapterを用い、App Storeだけ
E4Bの固定catalogへ進めた。Developer production catalogは空のまま。

専用QA appでQwenのロード、stream、Proposal保持、main window Diff、実生成元表示、明示Apply、
未保存、Undo、再依頼、Cancelを確認し、同じappを `system_default` で再起動してSystem生成と
`Apple Intelligence` provenanceも確認した。Qwen候補は校正として不正確で、品質合格ではない。
[実装・検証・残ゲート](reviews/2026-09-20-core-ai-phase1/README.md)。

## Local Assist表示整理（2026-09-20）

対象要約、依頼チップ、一体化した入力欄へ整理。冗長な説明を減らし、差分確認を会話の直下へ移した。
[実装・ブラウザー検証](reviews/2026-09-20-local-assist-polish/README.md)は完了。
次はnative窓での日本語IME・VoiceOver・本体Diffへの移動を確認する。生成・保存の契約は不変。

モデル選択はLocal Assist窓の入力欄下部・送信ボタンの左隣を主入口とする方針に更新（2026-09-20）。
DL・容量・削除は設定、選択正本はRustの `selectedId`。C-2実装時に接続する設計変更で、
本番catalogが空の現在はSystemのみ。catalogへ公開済み・検証済みモデルが入った後は
同じ選択枠で切り替える。Developer test backendでは同じ枠がnative選択済みの
`Core AI · Qwen3 0.6B (test)`を表示するが、配布catalogには入れない。
[選択UXの正本](core-ai-c0-design.md#5-モデル選択-uxc-2-店にしない)。

## v3.1 — I-0技術棚卸しと最初の修正（2026-09-19）

v3.1は **Core AIの実利用** と **英語を入口にした海外App Store展開** の二本立て。
Core AI本番C-1/C-2はlocked identity・expanded `resourceManifest`・配信/AOT・bake-offの
ゲートを維持する。Developer / GitHubレーン限定のfixture配管は着手可能だが、最初の
スライスは、本番identityを仮定せず進められるI-0から始める。

I-0のソース／静的棚卸しは `docs/international-launch/` に集約済み。英語UIの既存基盤、
最低OS、Local Assistの条件、通信境界、英語ストア文案、スクリーンショット/Web要件を
確認し、metadataのローカル検査も用意した。これは次を完了した意味ではない。

- App Store Connect上の対象地域、価格、契約・税務・銀行、Privacy回答
- 公開済みSupport / Privacy / Marketing URLと英語で受けられる問い合わせ導線
- 署名済み同一候補での英語UI、ネイティブメニュー、Help、VoiceOver、主要導線の受け入れ
- Core AIのモデルidentity、権利、容量、地域制限、配信方式

**I-0a完了:** 現行の `en` / `ja`（`kana`は日本語として `ja`）を増やさず、メイン窓と
Local Assist窓のHTML `lang`を表示言語へ同期した。保存済み日本語の初期反映、`kana`から
日本語への対応、英語への再切替をテストで固定した。これは読み上げ意味の不整合を直した
だけで、英語対応宣言や翻訳完了を意味しない。生成・保存、Assistの能力判定は変えていない。
外部レビューのP2・P3も同じスライスで閉じた。ルートの同期はUI chrome用とし、本文を描く面
（編集・プレビュー・読書・Local Assistの入力/生成途中・候補レビュー）はHTMLの「言語不明」を
持たせてUI言語を継承させない。本文へ差し込む画像ブロックの案内は日本語のアプリ文言なので
`ja`を宣言し、混ざるalt text・参照パスだけを言語不明にする（ページ区切り・テーブル枠・
L Modeタスクのラベルは英語なので `en`）。参照面とLocal Assistサイドバー
の固定対象も同じ境界。メイン窓・Local Assist窓はReact初回描画の前に保存済み表示言語を
反映するが、Agent窓はchromeが英語固定なので `en` のまま。Help・設定・診断と会話ログ
（依頼文・生成文がUI文言と同じ枠）、差分のヘッダ行はUI文言側なので残件。
実装・red/green証跡は `docs/reviews/2026-09-19-v3.1-i0a-document-language/`。

外部再レビューで残ったテーブル枠のP2も閉じた。枠の `aria-label="Markdown table"` は
`lang="en"` のまま、Markdown由来の子 `table` は `lang=""` へ戻し、raw HTMLで利用者が
明示した `lang` は保持する。

**I-0b完了:** 英語表示の主要導線をソース／既存テストから画面単位で静的に棚卸しした。
開始・編集、保存／衝突／復旧、設定、Help／診断、Reader、出力、Local Assistには英語の
分岐または英語固定本文がある。致命的フロントエラーの復旧面だけは英語UIでも日本語を
主表示していたため、`<html lang>` に応じた英語／日本語copyへ分離し、技術由来のエラー本文は
`lang=""` にした。外部レビューで見つかったfalsyなthrow値の取りこぼしも、エラー発生状態と
catch値を分離して閉じ、再レビューはP0 / P1 / P2 / P3なし。証跡は
`docs/reviews/2026-09-20-v3.1-i0b-english-major-flow-static-audit/`。

macOS bundleの言語宣言は、主要英語導線の静的／実表示監査と署名候補のInfo.plist確認後まで
保留する。宣言だけを増やさず、I-0のオーナー判断が閉じてからI-1へ進む。

**俯瞰レビュー追補（2026-09-20）:** H31-01の保存言語取得例外をen fallbackで閉じ、
H31-02の表の祖先lang継承をラッパー挿入前に保持した。入れ子・明示空文字も回帰固定。
詳細と検証は [修正記録](reviews/2026-09-20-v3.1-overview-followup/README.md)。
Core AIは[単体テスト用Qwen3-0.6B](core-ai-test-model.md)を準備し、実ロード・生成を確認。
日本語校正の結果は不正確で品質合格ではない。C-1/C-2製品接続は未実装、v3.1の二本立ては維持する。

**次のスライス:** 画像ブロック（remote／workspace外許可／load-failed）の英語復旧案内を閉じ、
専用テスト環境のbuilt appで英語起動→設定→保存／衝突→Reader→出力を
小さく分けて実表示確認する。nativeメニュー、Help、VoiceOver、署名候補は別ゲートのまま。
Core AIはE4BのApple-hosted source経路まで接続済み。未download・未検証の`selectedId`は
引き続き受理しない。ローカル`.aar`は生成済みで、次の配布ゲートはApple processing、
署名済みTestFlight受入。

## 3.0.3 — スクロールバー修正版を実機確認して申請（2026-09-18）

公開済み 3.0 系に対する不具合修正版として `3.0.3` を用意した。中身は編集面の
スクロールバー 3 件（右端で効かない／一気に最下部まで引くと少し戻る／離すと
キャレットの行へ吸い寄せられる。次の節と追補2）と、
追加レビューで見つかった編集ロックの抜け・1件置換の取りこぼし（下の節）だけで、
新機能は足していない。

- 版数: npm / Tauri / Cargo / package-lock / Cargo.lock を `3.0.3` に揃えた。
- 提出文案: `docs/releases/3.0.3-app-store-release-notes.md`（掲載用短文・詳細・
  TestFlight/審査で見る項目・提出用メモ）。`docs/releases/README.md` の索引と
  `README.md` / `docs/current-status.md` / `docs/handoff.md` / `docs/roadmap.md` /
  `docs/app-store-build.md` の現行版表記も 3.0.3 へ。
- 境界は不変: source 正本、明示操作、外部クラウドAIへ送らない、auto-save なし。

検証: `npm run typecheck` / `npm test` / `npm run build:vite` / `cargo fmt --check` /
`cargo test` / `npm run smoke:app-store-surface`。

実機と申請: オーナーが 3.0.3 候補を実機（WKWebView）で確認し、問題なしと報告
（2026-09-18）。その報告で申請する。署名済み App Store pkg は build 140 を作成済み
（`docs/app-store-build.md` の手順）。pkg のパスと SHA-256 の正本は
`docs/internal/app-store-candidates/latest.json` だが、この候補では未更新のまま
2.9.0 / build 125 を指している。

## 編集エリアのスクロールバーが右端で効かない（2026-09-17）

実機報告: 編集エリアのスクロールバーをマウスでドラッグしてもスクロールできない。
原因はドラッグ処理ではなく**つかむ場所**で、CSS の当たり判定が 4px だけ重なっていた。

- 通常の右ペイン表示時は `editor | 6px resizer | right pane` の3列（`useSidePaneResize`）。
- `.pane-resizer::before` が左右へ 4px 張り出していたため、**編集ペインの右端4px**を
  リサイザが持っていた。スクロールバーはペインの右端にあるので、そこでつかむと
  `mousedown` がスクロールバーに届かず、リサイザの `setPointerCapture` に食われる。
  縦にドラッグしても何も起きず、横に振るとペイン幅が変わる。
- ツリー側（`tree | 6px resizer | editor`）も同じ条件。
- `EditorPane` の v0.34 対策（スクロールバー mousedown での blur / mouseup での復帰）は
  `view.scrollDOM` 自身にイベントが来たときだけ働くので、今回は無関係だった。

直し: `.pane-resizer::before` の張り出しを**右だけ**に（`left: 0; right: -4px`）。
つかむ幅は表示6px + 右4px = 10px を確保する（修正前は左右へ張り出して 14px だったので
4px 狭くなる。実測でリサイザ操作は成立するため、スクロールバーを潰してまで 14px を
維持する理由はない）。左隣は必ず「右端にスクロールバーを持つスクロール面」なので、
左へ張り出さないのが正しい。コメントも実態に合わせて直した。
`src/styles/workspaceCss.test.ts` が左への張り出しを、`useSidePaneResize.test.tsx` が
6px のリサイザ列を固定する。

検証: `npm run typecheck` / `npm test` / `npm run build:vite`。
ブラウザ実測（`docs/reviews/2026-09-17-scrollbar-drag`）で、右端2pxからの縦ドラッグが
scroll 179→1441 になり、リサイザ単体（6px 列）も従来どおり動くことを確認した。
同種の当たり判定が他に無いことも、**fixture で到達できる主要面について**総当たりで
検査した（書く/プレビュー・L Mode・書き出し・差分は conflicts 0。アプリ全体の検査では
ないので、未計測面は同 review pack の `scan-scroll-edges.js` と README に列挙している）。
実機受入: オーナーが WKWebView で確認し問題なし（2026-09-18）。ネイティブで
重なり幅を厳密に測るのは別で、ヘッドレスの Chromium ではオーバーレイの
当たり判定を再現できないため未計測のまま。

## 追補 — 一気に最下部まで引くと少し上に戻る（2026-09-17）

実機の追加報告。原因は 2 つ重なっていた（実測と手順は
`reviews/2026-09-17-scrollbar-drag/README.md` の「追補」節）。

1. 編集→プレビューの同期ガードが**固定 80ms**で、ドラッグが続く間に切れ、
   キューに残ったプレビューの古い比率が本文の `scrollTop` を書き戻していた
   （`usePreviewScrollSync`）。プレビュー側は v0.34 で自己延長に直してあったが、
   編集側が取り残されていた。→ preview 側と同じ「連続イベントで自己延長（150ms）」に
   揃え、rAF 待ちの間に相手が書き込んでいたら降りる再チェックを両方向へ追加。
2. CodeMirror が行の高さを測り直して総高さが伸びるため、ネイティブのドラッグが
   終わった位置（その時点の最大）が末尾より上に残る。→ トラック下端で終わった
   ドラッグだけ、再計測が止むまで最大 8 フレーム底へ寄せ直す（`EditorPane`）。

回帰テストは `usePreviewScrollSync.test.ts`（ガードの自己延長）と
`EditorPane.test.tsx`（最下部での寄せ直し）。どちらも修正前の実装で落ちることを確認した。
実機受入: 同じくオーナーが WKWebView で確認し問題なし（2026-09-18）。

## 追補2 — 離すとキャレットの行へ吸い寄せられる（2026-09-18）

実機の追加報告: 編集面のスクロールバーをドラッグすると、**キャレットのある行へ
吸い寄せられる**ことがある（プレビュー側では起きない）。手順と実測は
`reviews/2026-09-17-scrollbar-drag/README.md` の「追補2」節。

in-app browser（Chromium）の fixture では再現しなかった。ネイティブドラッグ中の
`.cm-scroller` への JS 書き込みは 0 件（`?traceScroll=1`）で、離した位置のまま止まる。
書き換え経路はコード上 2 つで、どちらも v0.34 の「ドラッグ中は blur、mouseup で復帰」が
初めて動かすものだった。

1. CodeMirror `observers.focus` の「scrollTop が 0 なら直前に観測した位置へ戻す」。
2. Safari 26 系で `preventScroll` が効かないときの、フォーカス時のキャレット移動。

直し: mouseup でフォーカスを戻す直前にドラッグ位置を控え、復帰後に**1 フレームだけ**
取り戻す（`holdDraggedScrollTop`）。ユーザー自身の新しい操作
（ホイール・クリック・キー入力）があれば、その時点で降りる。末尾寄せ直し（前節）とは
役割を分けてあり、トラック下端で終わったドラッグの扱いは変えていない。

検証: `npm run typecheck` / `npm test`（288ファイル・2,565件）/ `npm run build:vite`。
`EditorPane.test.tsx` の新テスト2件（保持 / 新しい操作で降りる）は、保持の呼び出しを
外すと前者が `expected 500 to be 300` で落ちる。
実機受入: オーナーが WKWebView で確認し問題なし（2026-09-18）。Chromium では
フォーカス時のキャレット移動を再現できないため、ブラウザ側の証跡は当たり判定の幾何に留まる。

## 追加レビュー対応 — 編集ロックと置換、スクロールの境界（2026-09-18）

外部レビュー（固定 SHA `281a4863`）の指摘に対する修正。優先度の高い編集ロックから着手した。

### R1（P1）編集ロック中の置換が本文だけを書き換えていた

Local Assist の生成ロックは `EditorView.editable.of(!readOnly)` しか設定しておらず、
これは DOM からの直接編集を止めるだけで `dispatch({ changes })` は止めない。
自作の `replaceCurrent` / `replaceAll` にも検査が無く、ロック中でも CodeMirror の本文だけが
変わり、親の `handleEditorChange` が正本の更新を拒否するため**画面と保存対象が食い違う**
状態になり得た。

- `EditorState.readOnly.of(readOnly)` を `EditorView.editable` と一緒に設定（初期構築・更新の両方）。
- `replaceCurrent` / `replaceAll` の入口で `readOnly` / `state.readOnly` / IME 合成を検査。
- Tab インデントは読み取り専用ではイベントを奪わない（ブラウザのフォーカス移動に任せる）。
- 画像貼り付けは非同期完了の**適用直前**に `state.readOnly` を再検査。
- 検索は使えるまま、置換ボタンと置換 Enter をロック中は無効化（`replaceLocked` を
  `useAppShellController` → `AppDocumentFeedback` → `FindReplaceBar` へ通す）。

回帰テスト: `EditorPane.test.tsx`（ロック中は本文も onChange も変わらない／編集可能時は従来どおり）。

### R2（P2）つまみ中央を握って末尾へ運ぶと補正から漏れていた

「末尾まで引いた」の判定がポインタの絶対位置だったため、つまみの中央を握ると
ポインタはトラック下端よりつまみ半分ぶん上で止まり、補正が起動しなかった。
ドラッグ開始時のつかみ位置（つまみ内の相対位置）から「つまみが下端へ届くポインタ Y」を
計算する方式へ変更。高さの伸びが mouseup 後に複数フレーム続くケースも追従する。

回帰テスト: `EditorPane.test.tsx`（つまみ中央で末尾・ポインタが端を越える・中央で離す・
複数フレームの伸び）。ブラウザ実測も再取得（下の review pack）。

### R3（P2）ガード中に反対ペインを操作すると最後のスクロールを捨てていた

同期ガード中は反対ペインの scroll を一律に捨てていたため、150ms 以内にユーザーが
操作先を切り替えると最後の位置が残った。JS が書いたエコーとユーザー操作を分けるため、
ホイール / ポインタ / キー入力の入口でその向きの所有権を手放す
（`usePreviewScrollSync.releaseEditorGuard` / `releasePreviewGuard`、
`EditorPane.onScrollGestureStart`、`SidePane.onPreviewScrollGestureStart`）。
編集側の延長は「同期先への書き込み差分 10px 以上」から切り離し、操作が続く限り延長する。

回帰テスト: `usePreviewScrollSync.test.ts`（操作の受け渡し 2 方向・差分 10px 未満でも延長）。

### R4（P2）1件置換で次の一致を飛ばしていた

置換後に番号を 1 つ進めていたため、置換で当該一致が消えると次の一致が繰り上がり、
さらに次へ進んで 1 件飛ばしていた。置換後の位置から一致を選び直す
（`useFindReplaceState.selectMatchAfter`）。置換語に検索語が残る場合も、置換そのものの
中の一致へ留まらず、置換の後ろへ進む。末尾を置換したら先頭へ循環する。

回帰テスト: `useFindReplaceState.test.ts`（消える／置換語に残る／末尾→先頭）、
`useFindReplaceActions.test.ts`（位置ベースの選択・ロック中は何もしない・拒否時は進めない）。

検証: `npm run typecheck` / `npm test`（287ファイル・2,535件）/ `npm run build:vite`。
いずれも R1〜R4 の修正前実装で新テストが落ちることを確認してから通した。
実機受入: オーナーが WKWebView で確認し問題なし（2026-09-18）。

## 再レビュー対応 — ロックの残り入口と同期の競合（2026-09-18）

固定 SHA `8f560695` への再レビュー（P1×1・P2×3）に対する修正。

### R1継続（P1）自作コマンドの編集ロック検査漏れ

`replaceCurrent` / `replaceAll` / Tab / 画像貼り付けに続き、残っていた入口を塞いだ。
共通ヘルパー `features/editor/editorEditability.ts` の `canEditView(view)` を追加し、

- `lMode/taskWidget.ts`: `dispatchTaskToggle` をロック中は何もしない。ウィジェットは
  `aria-disabled` + フォーカス対象外にし、ロック切替時（compartment の reconfigure）に
  既存 DOM の属性も更新する
- `lMode/tableEditing.ts`: 行追加 / セル内改行 / パイプ挿入 / 選択行削除（doc を変える 4 つ）
- `useSlashMenu.ts`: `runCommand` の実行直前で検査し、ロック中はメニューを閉じる。
  `EditorPane` から `enabled: !readOnly` を渡して開かせない

回帰テスト: `taskWidget.test.ts` / `tableEditing.test.ts` / `useSlashMenu.test.ts`（いずれも
ロック中は本文が変わらないこと、ロック解除後は従来どおり動くこと）。

### R3継続（P2）予約済み rAF が所有権を奪い返す／プレビュー側のキー配線漏れ

`releaseEditorGuard` / `releasePreviewGuard` で、その向きの予約済み rAF を取り消し、
世代番号（`previewSyncGenerationRef` / `editorSyncGenerationRef`）で古い通知を失効させた。
プレビュー側の入力入口に `keydown` を追加（PageDown / PageUp / Space / 矢印 / Home / End。
入力欄・IME 合成・リンク操作は対象外）。

回帰テスト: `usePreviewScrollSync.test.ts`（旧予約が遅れて動いても新しい操作が勝つ）。

### R4継続（P2）次一致の選択が既存の番号補正と競合

置換後の選択要求を ref から state へ変え、**一致一覧が置換後の内容へ更新されてから**
解決するようにした（同じ語への置換は source が変わらないので即時解決）。
未処理の要求がある間は `useFindMatchIndexSync` の件数丸めを抑止し、同じ index を
2 か所から書かないようにした。同じ語への置換では本文を変更しない（dirty / Undo を作らない）。

回帰テスト: `useFindReplaceController.test.ts`（3件以上の末尾→先頭、同一語置換、
置換語内の一致スキップ、全一致消滅、1操作で1つだけ進む）。

### R2継続（P2）横スクロールバー併設時のトラック長

`captureScrollbarBottomIntent` が `rect.height` / `rect.bottom` を使っていたため、
横スクロールバーがレイアウト領域を占めると縦トラックを過大に見積もっていた。
横向きの帯（`offsetHeight - clientHeight`。オーバーレイでは 0）を除いた縦トラックで
つまみ長と下端到達 Y を計算する。

回帰テスト: `EditorPane.test.tsx`（横バー併設の幾何モデルで末尾到達が成立する／
437.5px の真の到達点に対し 420px の途中停止は補正しない）。

検証: `npm run typecheck` / `npm test`（288ファイル・2,548件）/ `npm run build:vite` /
`npm run smoke:app-store-surface`（10ファイル・125件）。R1〜R4 の新テストは
修正前実装で落ちることを個別に確認。
未処理: `npm audit` による moderate 2 件のトリアージ（依存ツリーを registry へ送る照会のため、
この作業セッションでは実行していない）。

## 検索の Unicode 境界（N1・N2、2026-09-18）

固定 SHA `b3b4f30e` への再レビューで、`useFindMatches.ts` に既存の不具合が 2 件見つかった
（比較元 `8f560695` と同一ファイルで、今回の修正が壊したものではない）。

### N1（P1）ゼロ幅一致の前進がサロゲートペアの途中へ入り、無限ループ

正規表現検索で空一致を採用しないときの前進が `lastIndex += 1` だった。`u` フラグは
サロゲートの途中を切り下げるため、本文 `😀` に `^`・`(?=.)`、`A😀B` に `(?=.)` で
「1 進める → 同じ位置の空一致へ戻る」を繰り返し、同期検索が停止しなかった
（`matches` に入らないので 999 件の上限も脱出条件にならない）。

- 前進を ECMAScript の `AdvanceStringIndex` 相当（`advanceStringIndex`）に変更。
- 同期処理が本文を走査し続けないよう、正規表現・リテラルの両方に反復上限
  （本文長の 2 倍 + 余裕）を追加。
- リテラル検索も「原文の上」の正規表現に変更（下の N2 の修正を兼ねる）。

### N2（P2）大小無視の検索が原文と違う範囲を返す

本文と検索語を小文字化して `indexOf` していたため、小文字化で UTF-16 長が変わる文字
（例: `İ` U+0130 → `i` + U+0307）より後ろで位置がずれていた。実測どおり
`İ foo Z` の `foo` は [3, 6) を返し、適用すると `İ fbarZ` に壊れる。`İabc` の `abc` では
本文長 4 に対し終端 5（範囲外）も返した。これはハイライトだけでなく置換トランザクションの
範囲そのものに影響する。

- 検索語をエスケープしたリテラル正規表現を**原文に対して**実行し、常に原文座標で返す。

回帰テスト: `useFindMatches.test.ts`（ゼロ幅 + 絵文字で停止し空結果／空一致の後ろの一致を
見つけられる／`İ` の後ろの大小無視一致が原文座標／範囲外を返さない）、
`EditorPane.test.tsx`（検索範囲をそのまま置換トランザクションへ渡し、`İ bar Z` になる／
全件置換 → ⌘Z で原文復帰）。N1・N2 とも修正前実装で新テストが落ちることを確認
（N1 は反復上限によりハングせず失敗する）。

実機受入: オーナーが WKWebView で確認し問題なし（2026-09-18）。

## 検索の境界と照合上限（N3・N4、2026-09-18）

固定 SHA `f6884872` への再レビューで、`useFindMatches.ts` に 2 件（いずれも既存）。

### N3（P2）反復上限の検査順と、その意味の訂正

`while ((match = regex.exec(source)) && matches.length < 999)` の順序では、
999 件そろっていても 1000 回目の照合（高コストになり得る）へ入っていた。
件数と上限を**次の照合より前**に検査する形へ変更（正規表現・リテラルの両方）。
`exec` 呼び出し回数が 999 で止まることを回帰テストで固定（`RegExp.prototype.exec`
の呼び出し回数を数える。旧順序では 1000 になる）。

**既知リスク（未対応・別スライス）:** この上限は「外周の照合回数」を制限するだけで、
**1 回の `exec()` がバックトラックで長引く時間は制限しない**（例: 本文
`"a".repeat(30) + "!"` に `^(a+)+$`）。Node での独立診断では 1 秒を超えた。
WKWebView での所要時間は未測定。「反復上限で対応済み」とは扱わない。
UI の応答性まで保証するには照合を Worker へ分離して外から打ち切る構成が別途必要。

### N4（P2）単語全体の境界判定が補助面の文字で崩れる

`isWordBoundary` が前後の文字を UTF-16 の 1 単位で取っていたため、サロゲートペアの
漢字・数字が片側だけになり `\p{L}` / `\p{N}` に一致せず、単語全体でない箇所まで
一致していた（`𠮷田` の `田`、`田𠮷` の `田`、`𝟙田` の `田`）。前後の隣接文字を
コードポイント単位で取得する局所対応に変更（直前の低サロゲートも見る）。
形態素解析や単語分割の仕様は広げていない。

回帰テスト: `useFindMatches.test.ts`（吉田 / 𠮷田 / 田𠮷 / 😀田 / 🙂田🙂 / 𝟙田 / 「 田 」、
正規表現検索でも同じ境界）、`EditorPane.test.tsx`（`𠮷田 田` の全件置換が `𠮷田 bar` になり、
名前の一部を置換しない）。N3・N4 とも修正前実装で新テストが落ちることを確認
（N3 は exec 回数 1000、N4 は前後それぞれを 1 単位へ戻して失敗を確認）。

## 依存の脆弱性トリアージ（2026-09-18）

ユーザー承認のもと **照会のみ**（依存は変更せず `npm audit --json`。`audit fix` は未実行）を
実行した。CI の `npm ci` が出していた「2 moderate」は、同一 advisory の 2 ノードだった。

| 項目 | 内容 |
|---|---|
| advisory | GHSA-82fw-gwwq-j7x9 — Vitest: Path Traversal / Arbitrary File Read via `@vitest/mocker` Redirect Mock |
| 深刻度 | moderate（CVSS 3.1 = 5.9、CWE-22） |
| 影響ノード | `vitest`（devDependency・直接）/ `@vitest/mocker`（vitest の推移依存） |
| 現在の版 | どちらも 4.1.9（`package.json` は `vitest: ^4.1.8`） |
| 修正版 | 4.1.11 以降（`fixAvailable: true`） |
| prod / dev | 両方 dev。`package.json` の devDependencies のみ（prod 34 / dev 147 / total 181） |
| 出荷物への混入 | なし。App Store lane は `frontendDist: ../dist`（`src/` の Vite ビルド）+ Rust + helper で、vitest の実装コードは含まれない。`dist` 内の "vitest" 文字列は同梱された `package.json` のテキスト（スクリプト名と依存レンジ）で、コードではない |
| 外部入力からの到達性 | なし。advisory はテスト実行時の mock / redirect 設定を攻撃者が制御できる状況（開発・CI 文脈）を前提とする。アプリの入力・ファイル・ネットワーク面からは到達しない |
| 判断 | **3.0.3（139）では受容する。** dev 専用・テスト時のみ・非同梱で、修正は開発ツールのパッチ上げ（`vitest` ^4.1.11）に閉じる。解消は別スライスで行い、依存更新と全ゲート再実行として記録する（無差別な `npm audit fix` はしない） |

再取得は `npm audit --json`（照会のみ。実行にはユーザー承認が必要。依存は変更しない）。

## 3.0.2候補 — メニューバーの明滅が3.0.1でも再発（2026-09-16）

公開済み `3.0.1` でも「文字を打つ・改行するとmacOSのメニューバーが明滅する」が再発した。
入力ごとにネイティブ側へ到達していた経路が2つ残っていた。

1. `useWindowTitle` が `activeTab` オブジェクトを依存に持っていた。本文更新のたびに
   tab object が差し替わるので、タイトル文字列が同じでも `set_title` のIPCが1文字ごとに
   走っていた。依存を `activeName` / `imageName` の文字列へ絞り、実際にタイトルが
   変わるまで送らないようにした。
2. `update_app_menu_state` は、`Save`項目の有効/無効などフラグだけが変わるときも
   `build_app_menu_with_state` + `app.set_menu` で**メニューバー全体**を作り直していた。
   macOSではこれがメニューバーの描き直しとして見える。保存直後の1文字目でdirtyが
   false→trueへ変わるたびに起きていた。
   適用済みの状態を `AppMenuStateStore` に記録し、(a) 同一stateなら何もしない、
   (b) フラグだけの変化は `apply_app_menu_state_in_place` で項目を直接更新する、
   (c) ラベルか項目集合が変わる場合（表示言語、最近使ったファイル/フォルダ）だけ
   再構築する、という3段階にした。

`Save` / `Save As` の有効・無効は `active_dirty` / `has_active_tab` として引き続き
追従する（回帰テストで固定）。読み方・保存・書き出しの挙動は変えていない。

検証: `cargo test` 392件（+2 ignored）、`cargo fmt --check`、`npm run typecheck`、
`npm test`（287ファイル・2,517件）、`npm run smoke:app-store-surface`（125件）。
`useWindowTitle` の1文字ごと送信は**修正前のテストが落ちる**ことを確認してから直した。
`menu_state_needs_rebuild` はフィールドごとに、フラグのみ / 再構築要 / 同一stateの3分類を
Rustテストで固定した。`npm run build:app-store-preview` は通過し、
`3.0.1`のローカル.app（App Store lane・ad-hoc署名）を実機確認用に作成した。
実機での見た目の確認は3.0.2候補.appの別工程に残る。

### 外部レビュー後の再修正（2026-09-16）

再レビューで、**App Store laneでは in-place 更新が必ず失敗して `set_menu` に戻る**ことが
見つかった。`build_app_menu_with_state` は `agent_workbench_allowed` が false のとき
`MENU_OPEN_AGENT_WINDOW` をメニューへ追加しないのに、in-place 側が無条件に要求していた。
MAS版こそ今回直したい lane なので、これは実害のある blocker だった。

- optional な項目（Agent Workbench / Local Assist）は、構築時と同じ配布 lane 条件で
  guard する。存在しない項目を黙って無視するのではなく、そのlaneに本来無いものだけを
  条件で外し、Saveなどの必須項目が消えた場合はエラーのままにする。
- あわせて in-place を **delta apply** にした。`previous` と `next` を比較し、変わった
  フィールドの項目だけを更新する。テーマのラベル書き換えも
  `theme_preference` が変わったときだけ実行する（dirtyだけの変化で全項目を触らない）。
- `useWindowTitle` はタイトル文字列そのものを依存にした。画像プレビュー中はタイトルが
  画像名だけで決まるので、背後の本文やdirtyが動いても同じタイトルを再送しない。

このHighがテストをすり抜けた理由も残しておく: 分類器（`menu_state_needs_rebuild`）だけを
テストしていて、in-place が「そのlaneに無い項目を要求しないか」を見ていなかった。
今回 `plan_app_menu_updates` を純関数として切り出し、**App Store laneの計画に
Agent Workbench項目が入らない**ことと、変更フィールドだけが並ぶことをテストで固定した。
guardを外すとこのテストが落ちることも確認済み。

### 外部レビュー後の再々修正（2026-09-16）

delta化で新たに露出した経路を1本塞いだ。

- `emit_app_menu_event` は、テーマ項目が押された瞬間にReactへイベントを送る**前に**
  `sync_theme_menu_state` でネイティブの「●」を動かしていた。フロントはモーダルまたは
  保存衝突UIが出ているとQuit以外のメニューイベントを捨てるので、
  「設定ダイアログを開いたままメニューからテーマを選ぶ」と、**アプリは元のテーマのまま
  ネイティブの●だけ新テーマ**になる。delta化により、その後dirtyなどが変わっても
  `theme_preference` 自体は変わっていないので直らない経路になっていた。
  先行同期を削除し、テーマの正本をReact側に一本化した（受理されて `themePreference` が
  変わったあとに `update_app_menu_state` 経由でネイティブへ反映される）。
- 重複していたテーマ同期経路を畳んだ。`useThemeMenuStateSync` と
  `update_theme_menu_state` command、`lib/tauri/theme.ts` を削除し、
  `AppMenuState` の `ThemeSync` を唯一の経路にした。

回帰テストは2本。フロント側に「モーダル表示中のテーマメニュー操作で
`setThemePreference` を呼ばない」、Rust側に「`emit_app_menu_event` が
`sync_theme_menu_state` を先行実行しない」を追加し、先行同期を戻すと後者が落ちることを
確認した。検証: `cargo test` 393件（+2 ignored）、`cargo fmt --check`、
`npm run typecheck`、`npm test`（286ファイル・2,517件）。

### チェック項目にも残っていた同型の経路（2026-09-16）

テーマと同型の「nativeがReactより先に状態を変える」経路が、View のチェック項目にも
残っていた。muda 0.19.3 の macOS 実装は、チェック項目がクリックされると
`set_checked(!is_checked())` を実行してから `MenuEvent::send` する。フロントは
モーダルまたは保存衝突UIがあると Quit 以外のメニューイベントを捨てるので、
**Preview / Lモード / 行の折り返し / 不可視文字 / スペルチェック** の5項目で
「アプリは元のまま、ネイティブの✓だけ反転し、delta化により後からも直らない」状態が
起きていた。

`emit_app_menu_event` に、イベントを送る前に `AppMenuStateStore` の正本値へ
チェック表示を戻す処理を入れた。受理されたクリックはこれまでどおり
`update_app_menu_state` のdeltaで新しい値になる。モーダル中に捨てられた場合は、
正本へ戻した表示がそのまま残る。

`canonical_check_state_for_action` を純関数として切り出し、5項目の対応
（preview / l mode / wrap / invisibles / spellcheck）と、チェック項目でない
アクションでは何もしないことをテストで固定した。`emit_app_menu_event` が復元を
呼ぶこともRustテストで固定し、呼び出しを外すと落ちることを確認している。
検証: `cargo test` 395件（+2 ignored）、`npm test`（286ファイル・2,517件）、
`npm run typecheck`、`cargo fmt --check`。

## 3.0.1候補 — 文字入力ごとのメニューバー再構築の修正（2026-09-15）

本文の1文字入力で `useAppMenuStateSync` の `activeTab` オブジェクトが差し替わり、
macOSのネイティブメニューバーが `app.set_menu` で丸ごと組み直されていた。
前回の修正では `hasActiveTab` のbooleanに依存を絞り、本文だけの差し替えでは
再構築しないようにした。今回さらにdirty遷移境界の回帰テストを追加して、
Saveメニューの有効/無効と保存後の解除を固定した。

版数はnpm / Tauri / Cargo / package-lockを`3.0.1`へ揃えた。README・App Store docs・roadmapの
現行ソース版の記述も整合した。公開版はまだ3.0.0のままであり、3.0.1の提出・公開は別工程。

`npm test`（283ファイル・2,502件）、`cargo test`（385件・2件host-dependent ignored）、
`cargo fmt --check`、`npm run build:vite`、`npm run smoke:app-store-surface`（10ファイル・125件）通過。
`npm run build`（3.0.1 / build 134）はローカルsmoke `.app`まで通過済み。
typecheckはversion bump後のHEADでも通過済み。署名pkgとnativeメニュー、実職の
IME・保存衝突・Local Assist実運用の受入は3.0.1候補.appの別工程に残る。

### 外部レビュー後の追加修正（2026-09-16）

`57c4fd74`へのレビューで、TabBarの見切れスクロールが実際には動いていなかった
（`.tab-item`へrefを登録しておらず、右方向のはみ出し量も`Math.min(0, ...)`で
常に0になっていた）。ref登録と右方向の計算を直し、実測rectを差し替える回帰テストで
修正前に落ちることを確認した。あわせて、境界型が`lf | crlf`しか持たない改行コード欄の
`mixed` / `none`表示は撤回し、Diagnosticsのkana文言を既存の読み上げ調
（ひらがな＋語間スペース、外来語はカタカナ）へ揃え、同名タブの識別上限だった
`depth < 24`の固定マジックナンバーを祖先長から導出する形にした。

この修正後の確認は`npm run typecheck`、`npm test`（286ファイル・2,514件）、
`npm run build:vite`、`npm run smoke:app-store-surface`（125件）通過。
TabBarの見切れは幅の狭い実機で最終確認したい。

再レビューで残っていたのは、診断画面のコピー操作グループに名前が無い点だけだった。
`actionLabel`を`role="group"`の`aria-label`として配線し、コピー結果の読み上げは
ボタン名の変化に任せている（専用のlive regionは二重読み上げになるため、VoiceOver
実機受入で必要性を判断する）。

App Store提出用の文案は[3.0.1提出文案](releases/3.0.1-app-store-release-notes.md)。
掲載用の短縮版と実機・審査で確認する項目をまとめてある。実機受入が済むまで
提出・公開の結果は書かない。

## v3.0.0を公開（2026-09-14）

オーナーがv3.0.0の公開を報告。Mac App Storeの製品ページでバージョン3.0.0を確認した。
v3 UI/UX刷新（モック24画面対応）とLocal AssistのSystem共通基盤（LA-1a）が、この区切りでストアへ到達した。
公開buildとソースの対応・build番号・TestFlightでの個別受入結果は独立未確認
（[3.0.0候補記録](releases/3.0.0-source-tag.release.md)）。未コミットで残っていたv3最終調整は
区切りごとにコミットし、GitHubソースタグ `v3.0.0` を作成した。READMEと公開画像はv3のネイティブキャプチャへ更新済み。
次は公開後のフィードバック整理と、下の判断待ち・残課題からの選択。

## 編集画面のクローム（2026-09-13）

タブのテーマ固有上下線、えるモード左の空列、下段の重複情報を整理。7テーマ・5タブ・狭幅・隣接操作をQA実機で確認。
Local Assistラベルの文字選択抑止はブラウザfixtureで確認。全2,498件・型検査/Vite・surface125件成功。
[変更・画像・検証範囲](reviews/2026-09-13-editor-chrome/README.md)。

## 「読む」の見開き・文字サイズ（2026-09-13）

既定サイズで見開きが収まる可変幅と中央余白を調整し、上部から既存の表示文字サイズを変更できるようにした。
ページ計測の端数と目次再選択時の送り停止も修正。全2,498件・型検査/Vite・surface125件成功、QA実機で再確認済み。
[変更と実機画像](reviews/2026-09-13-reader-layout/README.md)。

## 「確認」の往復不具合（2026-09-13）

差分の入力を遮る透明なホスト、編集へ戻った後に残る比較、WebKitの選択クリック消失を修正。
QA実機で長文スクロール・3往復・再編集の反映・Undoを確認。全2,495件と型検査/Vite/surface125件成功。
[原因と検証範囲](reviews/2026-09-13-review-navigation-fix/README.md)。

## 空気感の実機調整（2026-09-13）

設定/ヘルプの重複案内、検索の密度、読書見出し、復旧/衝突の紙面を調整。
狭幅は文書領域960px以下で一面へ切替。実機で見つけた目次なし文書の幅崩れも修正した。
専用QAアプリで変更前後と代表操作を確認し、全2,492件・型検査/Vite・surface125件が成功。
[前後画像と確認範囲](reviews/2026-09-13-v3-atmosphere-polish/README.md)。
提出候補の作り直しと下記のv3全体受入は引き続き別。

## 現在の区切り — 読書面・確認面のモック寄せ（2026-09-13）

「読む」の読書面をモック04へ寄せ、目次は左の常設レール・上部は書名とタグ・ページ操作は
紙の外の下部操作帯（53px、中央寄せ）にした。「確認」の面は文書クローム（タブ・表示ツールバー）
を出さず全高を使い、提案レビューを開くときはプレビューも畳む（「プレビューが表示されたまま」
の修正）。typecheck / 全Vitest **282ファイル・2,489件** / Vite build が成功。
表示・実測・未決は [モック寄せの記録](reviews/2026-09-13-v3-reader-review-mock/README.md)。
未受入: 実機での読書面の操作感、提案面の実表示（fixture で生成不可）、参照面の見え方。

## 次の一手 — v3の実機受入（2026-09-12）

意図する未コミット修正を確定して候補を再作成し、その候補で保存/復旧、IME/読書復帰、
Local Assistの生成/停止/反映/Undo、書き出し現物、全テーマ/狭幅を受け入れる。
提出文案は最新UI・江戸彼岸・LA-1aへ整合済み。27固有検証の完了は主張しない。
候補の同一性と残確認は [3.0.0候補](releases/3.0.0-source-tag.release.md) を参照。

## 江戸彼岸の意匠調整（2026-09-12）

既存の明色パレットを保ち、全面の葉影と暗い起動演出を、同梱の枝花と少数の花びらへ置換。
設定の見本・説明も揃え、Previewのリンク/コードとReaderに残った暗色時代の指定を修正した。
全282ファイル・2,486件、型検査/Vite、surface 125件が成功。実コンポーネントの1440/960幅と
えるモードを目視比較済み。nativeでの動き・操作受入は未実施。
実装意図・前後画像・再実行は [江戸彼岸の調整記録](reviews/2026-09-12-v3-edohigan-refinement/README.md)。

## 現在の区切り — 分離窓の江戸彼岸色を修正（2026-09-12）

オーナー報告「特定のテーマで Local Assist の色味が変」。分離窓に江戸彼岸が暗色だった時代の
固定色 `#322438` が残り、明色化後の `--text` が窓地と 1.28:1 まで沈んでいた（他6テーマは
10.5〜15.1:1 で正常）。基の `--bg` へ戻し、`themeContrast` に分離窓の面のコントラスト契約
（全7テーマ・4.5:1）を追加。失敗テスト先行→修正で全283ファイル・2,487件、typecheck/Vite、
surface 125件が成功。詳細・前後画像は [分離窓のテーマ修正](reviews/2026-09-12-v3-assist-window-theme/README.md)。

## 現在の区切り — LA-1a: 利用可否と生成能力の分離（2026-09-12）

Local Assist v3共通基盤の第一スライス。生成前ゲートが四態probeの文字列を通っていたため、
locale（生成能力）の失敗が `unavailable` に混線していた（`unsupported_language` 分岐は実質到達不能）。
fixture/live共通の純関数 `AssistRuntimeContract` を新設し、利用可否（四態wire、不変）と生成能力
（locale、26未満は不明）を分離。ゲートは能力失敗を `unsupported_language` に分類（文言は不変）。
swift test 16件、live(arm64/x86_64/universal)・fixtureのビルドとsmoke、実機live生成、cargo 385件を確認。
27 SDK環境が無いため、27固有APIの照合とSystem評価は続くスライス（LA-1b）。
詳細: [LA-1aの記録](reviews/2026-09-12-v3-la1-availability-capability/README.md)。

## 最終調整 — 日常操作の継続（2026-09-12）

新規作成直後と読書からの復帰時の入力、同件数の別検索で残る選択行、書き出し終了後の
フォーカス復帰を修正。ブラウザの実操作、再現テスト→修正、全283ファイル・2,479件、
型検査/Vite、App Store surface 125件を確認。配布候補.appでの日本語IME・native復帰は次の受入。
詳細と画像は [最終UI確認](reviews/2026-09-12-v3-final-ux/README.md)。

追加の見た目確認では、書き出しの紙色・重複余白・左端、設定の文字見本の整列を調整。
設定の項目移動でタイトルが隠れる外枠スクロールも修正した。
比較画像とnativeでの残確認は [デザイン調整](reviews/2026-09-12-v3-design-polish/README.md)。

## Current Phase

v3.0.0は2026-09-14に公開された（オーナー報告・ストアページでバージョン3.0.0を確認）。
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**（System共通基盤LA-1a）はこの区切りに到達した。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — 実機ラウンド第4弾: 信号機と文書名の距離（2026-09-11）

実機で「左上のシステムボタンの位置と、隣のファイル名との距離が気持ち悪い」との指摘。
モックを実測して差分を特定し、オーナーが調整ウィジェットで値を決定した。

- モック: 玉は窓の左から**20px**・11px玉・18pxピッチ、文書名は左から**127px**
  （その手前93pxに切替アイコン）。実アプリは右端73px・文書名84px＝**距離11px**で詰まっていた。
- 決定: `trafficLightPosition {x:20, y:27}`（y は 66pxバーの縦中央）＋ 文書名の左を
  **127px**（新トークン `--toolbar-document-inset`）。実測の根拠は
  `reviews/2026-09-11-mock-gap-sweep/README.md`、ウィジェットは同ディレクトリの
  `traffic-light-tuning.html`。
- 契約テスト: `workspaceChromeCss.test.ts` が CSS と Tauri config の**両方**を読んで
  「信号機の右端 < 文書名の位置」を検査する。
- 実機fixture実測: 1440 / 1024 / 960 のいずれも重なり・はみ出しなし。
- **信号機はネイティブなので配布候補を再ビルドしないと反映されない。**
- **C2（プレビューの現在見出し・第7報）**: オーナー案「一瞬出るアウトライン情報を使えないか」。
  プレビューは独立スクロールなので、**プレビュー自身の位置**から見出しを求める純関数
  （`components/editor/preview/previewSection.ts`）を作り、紙の上端に**貼り付く薄い一行**として表示。
  紙の先頭では出さない（情報を増やさない）。実測: 先頭 null → スクロールで見出しに更新。
- **フォント・余白の調整（第6報）**: オーナーの指摘6点を実測して反映。
  モードナビ 43→**36px**（12.5px）、タブ 42→**36px**（12px）、タブ行 92→**81px**、
  ペイン区切りは**1px**の線に（6pxはつかむ幅として維持）、フォントサイズ呼び出しは
  スライダーのアイコンから**「Aa」の印**へ、選択中モードの面を `--accent-soft`＋内枠に
  （ライトで1.07→1.14・暗で1.62）。罫線の重複は近接3px以内の水平線を探索して**0件**。
  C2（プレビュー先頭の eyebrow）は**本の章情報をプレビューへ渡す配線**が要るため次のスライスへ。
- **デザイン見直し（第5報）**: オーナー「ボタン位置は完璧、文書名はもう少し左、全体も見直して」。
  文書名を **96px**（旧127px。標準ボタンの右端 約72px から24px＝モックのリズム）へ。
  起動画面の左面に **「🛡 ファイルは、自分のMacに。」** を追加（モック01。ボタン群の34px下・
  アイコン14px・3言語）。未着手の候補（B3 起動画面のフッターリンク / C1 パンくず /
  C2 プレビューの eyebrow / C4 ステータスバーのパス / A サイドバーの「この文書」節）は
  `reviews/2026-09-11-mock-gap-sweep/README.md` に理由付きで整理。
- **決着（第4報）**: `trafficLightPosition` の指定を**削除して macOS 標準の位置に任せた**。
  指定があると、テーマ切替で窓の外観が変わったときに macOS のタイトルバー組み直しで指定が
  失われ、ボタンが動いて見えた。標準位置なら組み直されても同じ場所へ戻るので**動かない**。
  オーナーの判断は「変化しないことを優先」。文書名の 127px と上部バーの高さ固定（66px）は有効。
- 第3報（「テーマを切り替えただけでも動く」）: 原因は**窓の OS 外観の変更**。
  テーマ変更で `setCurrentWindowTheme` が走ると macOS がタイトルバーを組み直し、
  `trafficLightPosition` が失われる（マウント時にも不要に走っていた）。
  → `features/app/windowAppearance.ts` で**生成時の設定と同じ・同じ基調のテーマ間では
  呼ばない**ようにし、外観変更を「明↔暗のまたぎ1回」まで減らした。
  この1回は Tauri 2.11 に実行時の位置設定APIが無いため消せない（docs に明記）。
- 第2報（「相対的に動いて見える」）: ネイティブ側は一度きり（Rust に実行時の位置変更は無い）。
  原因は**上部バーが `min-height: 66px` で伸びる**こと（実測 66 → 77px）と、アクション群の
  `flex-wrap: wrap`。バーを **`height: 66px` に固定**し（2行の文書名でも 66px・中心も一致）、
  `nowrap` にして伸びる余地を閉じた。契約テストで `y === (66-12)/2` を検査。

## 現在の区切り — 外部UIレビュー R1〜R8 の整理と着手（2026-09-12）

外部レビュー（対象 `2438ef1f`）を整理し、パッケージ1の一部＋小さなフォーム群を閉じた。
整理表・受入マトリクス・誤った保証の取り下げは `reviews/2026-09-12-external-review-r1r8`。

- **R2 書き出しの枠（P2）**: 揃えるのは本文の min-height ではなく**外枠の高さ**。長い文書名で
  ヘッダーが伸びるとフッターが枠外へ出ていた（原典: 960×640・240字名で 69.19px はみ出し）。
  → 外枠を `height: min(779px, calc(100dvh - 32px))` に固定し、本文だけスクロールさせる。
  実機fixture実測: ヘッダー 77→182px・本文 397→292px・フッターは枠内。
- **R4 文字サイズ（P2）**: 即時 clamp のため2桁を打てなかった（"2"→12、"120"→22）→ 入力中の
  文字列draftを持ち、blur/Enter で確定（Escape は取消・空確定は元に戻す）。slider は即時のまま。
- **R7 保存ボタン（P3）**: 空の新規文書は dirty ではないため保存できなかった → `pathなし || dirty`。
  （空の新規文書を dirty 扱いにはしない。）
- **R8 Local Assist（P3）**: 利用不可の理由と復帰手順が畳んだヘルプにしかなかった → 状態と要件を
  composer 直前に1行常時表示し、無効な入力欄と `aria-describedby` で結ぶ。詳細はヘルプのまま。
- **誤った保証の取り下げ**: 「multiply ならコントラスト比が保たれる」は成立しない（同率の暗化でも
  比は一定にならず、RGB値と相対輝度も別）。合成後の読みやすさは実機受入へ移した。DPR cap の変更も
  描画ピクセル上限が normal 約1.78倍・subtle 約1.44倍になることを明記した。
- **R3 書き出しEscape（P2）**: 草稿の所有者を controller へ上げ、**利用者のキャンセル（ボタン・Escape）と
  確定が同じ終了口**を通るようにした（片方だけが草稿を捨てる状態を無くす）。形式切替の内部キャンセルは
  素の cancel のまま＝切替では草稿が保たれる（実機fixtureで往復を実測）。
- **R6 形式切替の枠（P2）**: 実機fixtureで切替中の DOM を rAF サンプリングしたところ
  `EPUB → PDF` は **10ms（1フレーム）で入れ替わり、枠が消えた区間は 0 件**（原典も「速い処理では
  目立たない可能性」と留保）。遅い prepare での再現は未計測 → 外枠を1つ維持する実装の要否は
  その計測後に判断する。
- **R1 読書面のキー（P2）**: ページ送りキーの所有権を純関数へ切り出し、**モーダル中・
  自分のキーを持つ面（ペイン境界の `role="separator"`）・非表示/inert の下**では処理しない。
  フォーカスを読書面へ戻すのは所有権の判定を通ったあとだけにした（ダイアログ操作中は奪わない）。
  実機fixtureで原典の再現手順を実行し、ArrowRight×2 で **Page 1/6 のまま**を確認。
- **R5 パレット/Quick Open（P2）**: 結果の実行を `onClick`（キーボード由来の `detail === 0`
  だけ）でも受け、`onPointerDown` は主ボタンだけにした（右クリックで実行・閉じをしない）。
  パレットと Quick Open に `trapFocusInElement` で自身の Tab trap を接続。
- **R6 形式切替の枠（P2）**: 切替が「閉じてから次の準備」だった順序を反転し、**枠は閉じずに
  準備させ、新しい要求を載せるのと同じ tick で入れ替える**。実機fixtureの401フレームで
  枠が消えたフレーム **0**、高さ・位置も全フレーム一定。本スコープの準備を保留した状態でも
  直前の枠が残ることをフックのテストで固定。
- **R6 再オープン → F1/F2 で修正**（第2次レビュー対象 `c11721d7`）: `replaceOpen` が表示中の
  所有者を次形式へ**乗っ取っていた**ため、**切替の準備中にキャンセルすると新しいダイアログが
  後から開き（F1）**、**準備が例外で終わると残った旧画面が確定できなくなっていた（F2）**。
  切替を「所有者の乗っ取り」から**別枠の transition（世代 id 付き）**へ変え、利用者のキャンセルは
  `endExportSession()`＝**セッション全体の終了**にした（ボタンと Escape が同じ口）。
  準備中の旧形式の確定は**仕様どおり実行**（押せるのに無反応、にはしない）。
  実機fixture再測: F1/F2 の再設計後も **396フレームで枠が消えたフレーム 0**・高さ781一定。
  F1/F2 は fixture で「準備中」の窓を作れないため、**Hook テスト（保留 Promise）を証跡**とする。
- **F3 Quick Open の Escape（P3）**: Escape が input にだけ付いていた（パレットは共通ガードが
  拾っていた）→ **面（dialog）側へ上げ**、input 側から外して二重取消を無くした。
- 残り: 実機受入（WKWebView / VoiceOver / 日本語IME / WebGL / 信号機 / 配布候補.app）と、
  差分の行内ハイライト（`del`/`ins`）。

検証（2026-09-11 時点・最終）:

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | ✅ |
| Vitest 全体 | ✅ **279ファイル / 2,457件** |
| `npm run build:vite` | ✅（既知のチャンク警告のみ） |
| `npm run smoke:app-store-surface` | 未実行（App Store 面を触っていない） |
| `cargo test` | 未実行（**Rust 無変更**） |

**未解消のフレーク**: `src/components/app/AppWorkspace.test.tsx` の
「whole-book edit returns to the retained editor only on open success: true」が全体実行で1回だけ失敗
（当時の実行は結果を絞り込んだため **assertion とログは未取得**）。単体・再実行では緑。断定せず残す。

## 現在の区切り — 実機フィードバック第3弾・7件（2026-09-12）

実機で触って出た7件。エクスポートの形式切り替え、Local Assist の言葉、読むの紙の余白、
江戸彼岸のプレビューの影、お遊びテーマの強さ、システムボタンの位置、タブの演出。
計測は前回同様**実アプリをブラウザに描いてネイティブ境界だけスタブ**し、操作は **CDP の
実マウスクリック**で行った（このアプリのトグルは `onPointerDown` 系で `element.click()` が効かない）。

- **エクスポート（①②）**: 形式ナビだけ左余白が無く枠の左端に接していた（ヘッダー・本文は24px）→
  揃えて**タブ帯**にし、本体と繋げる。切替は「閉じて次を開く」実装で**本文の高さが違う**ため枠が
  伸び縮みしていた（実測 body EPUB 542 / PDF 434 / HTML 273 → 枠 777 / 669 / 508）→
  `min-height: min(542px, calc(100dvh - 264px))` で固定し、この面の登場フェードも止める
  （実測 3形式とも **720×779**）。
- **Local Assist（③）**: ヘッダー先頭の「ことばを、整える。」を削除。但し書き（安全のための情報）は
  畳んであるヘルプへ移動し、作業に要る情報（対象文書）だけを上に残す。copy `title` も削除。
- **読むの紙（④）**: 紙に横の余白しか無く、本文1行目が紙の上端に接していた（実測 1px）→
  上下の余白トークンを新設して **30px**（左右は40pxのまま、見開きも維持）。
- **江戸彼岸（⑤a）**: このキャンバスだけ `mix-blend-mode` が無く、不透明のまま本文より手前に
  描かれていた（実測: プレビュー面の紙が 252 → 48 まで低下）→ `multiply` + `opacity: 0.25`。
  **誤った保証の取り下げ（外部レビュー）**: 当初「multiply は紙と文字を同じ係数で暗くするので
  コントラスト比が保たれる」と書いたが、これは一般には成立しない（比は `(L明+0.05)/(L暗+0.05)` で
  同率の暗化でも一定にならず、RGB値と相対輝度も別の量）。テストが示すのは**合成の指定が入っている**
  ことまでで、読みやすさは保証しない。合成後の本文・薄い補助文字・選択範囲・リンク・ダイアログ上の
  見え方は実機受入で確認する。
- **お遊びテーマの強さ（⑤b）**: `Q-THM-1` の DPR cap を一段だけ戻す（normal 1.5→2 / subtle 1.25→1.5。
  フレーム間引きは据え置き）＋オーバーレイの滲み・ビネットを一段強く。
  **無コストではない**: 実DPR 2以上では描画ピクセルの上限が normal 約1.78倍・subtle 約1.44倍になる。
  確認は演出のFPSではなく、文字入力・スクロール・リサイズ・非アクティブ・最小化復帰・Reduce Motion。
- **システムボタン（⑥）**: `trafficLightPosition` を **(21, 27)** へ（モックの内側余白 + バー66pxの縦中央）。
- **タブの演出（⑦）**: CRT/深海の色収差・グローを**タブから引く**（サイドバーの文字だけに残す）。

検証: typecheck / 全Vitest **278ファイル・2,433件** / Vite build / App Store surface **120件**。Rust 無変更。
資料: `reviews/2026-09-12-v3-feedback-3`。
未受入: 江戸彼岸のキャンバスの合成（WebGL はヘッドレスのキャプチャに写らない＝CSS契約テストで固定）、
信号機の位置（ネイティブ）、エクスポート切替の体感、Local Assist の窓、テーマの強さの体感。

## 現在の区切り — 外部レビュー follow-up（P2 / P3・2026-09-11）

ドーン氏のレビューで挙がった2件。どちらも「設計の意図が実際の挙動に届いていない」型。

- **P2 文字コードの1チップ**: select の `value` が常に `save:<現在の文字コード>` で、selected が
  必ず「保存する文字コードを変える」側だった（ネイティブ select / キーボード / VoiceOver は
  selected を基準にするため、安全側の「読み直す」を先頭に置いた狙いが弱まる）。select を
  **アクション選択**にし、`value=""` の**中立 placeholder**（「操作を選ぶ」）を selected に。
  現在の文字コードはチップの表示が示す。操作後は中立へ戻す。aria-label は「文字コードの操作」。
  実測（実アプリの fixture）: `"save:utf-8"` → **`""`**。見た目は不変（select は `opacity: 0`）。
- **P3 確認メニューの残り**: `WorkspaceModeNavigation` の open を無効化する signature に
  `readingOpen`（＝`canReview`）が無く、「確認を開く → 読む」で操作不能な popup が読書面の上に
  残っていた。signature に `canReview` を足し、トリガーの有効条件と同じ由来で閉じるようにする。

検証: typecheck / 全Vitest **278ファイル・2,430件** / Rust無変更。
資料: `reviews/2026-09-11-v3-followup-p2p3`。

## 現在の区切り — 実機フィードバック第2弾・11件（2026-09-11）

1回目の修正を載せた実機で触って出た11件（右上の書き出す／アイコンずれ／信号機の位置／
ペイン見出しの説明／罫線とスクロールバー／えるモードの紙／見開きにならないケース／
差分の上部の空白とデザイン／サイドバーの検索／全体のスッキリ感）。今回は
**実アプリ（`App`）をブラウザに描き、ネイティブ境界だけスタブして実測**した
（`reviews/2026-09-11-v3-shell-look`）。

- **上部バー**: 右上に「**書き出す**」を追加（既存の書き出しダイアログ＝形式ナビ付きを開くだけで
  新しい経路は作らない）。ナビのアイコンは `span` が 14pxのSVGに対して**高さ20pxの行ボックス**に
  なり、ベースラインに乗って文字とずれていた → `inline-flex` で中央揃え（実測 20px → 14px）。
  信号機は `trafficLightPosition y:18` でバー66pxの中心から **9px 上**に寄っていた → `y:27`。
- **ペイン見出し**: 「プレビュー」＋「縦スクロールで見た目を確認」の2段はモック（`PREVIEW / 表示のみ`）より
  説明的だった。説明はホバーへ回し、見出しに残すのは**情報だけ**（アウトラインの注意件数、参照の
  「読み取り専用」＝安全に関わる）。参照ペインの見出しはファイル名に。
- **静けさ（罫線・スクロールバー・紙）**: タブ領域の横線が**3本**（`.tabs-row`＋`.tab-list`＋
  アクティブ下線）あったので `.tab-list` の下線を外し、読み取り操作群の囲み枠も撤去。
  `::-webkit-scrollbar` の自前定義をやめ（macOSのオーバーレイが無効になり常時バーが出ていた）、
  **えるモードの紙をモック準拠のニュートラル**（`#fffefb` / インク `#24362d` / アクセント `#356b50`）へ。
- **サイドバー下端**: ゴミ箱だけだったので「**フォルダ内を検索**」を並列に追加（モック準拠）。
- **見開き（⑦）**: 前付/導入の章が `max-width:min(620px,100%)` で見開き閾値1090pxに届かず、
  1列しか使わない章では紙だけ広がって**右半分が空いていた**。上限を撤去し、紙は**実際に使う列数**に
  合わせる（`data-spread="one"`→455px／`"two"`→996px）。**表示幅だけ**を縮め、flow は見開き幅のまま
  据え置く（縮めた結果で組み直すと列もページ計算も崩れて本文が切れる）。
- **差分（⑧⑨）**: 空の `.reference-editor-host` が **119.5px** を占め、差分が下に押されていた
  （auto行が2つで中身の無いホストにも高さが配られる）→ 同じセルに重ね、上寄せに。入れ子の枠は3段→1段。
  行内の語単位ハイライト（モックの `del`/`ins`）は**未実装の残件**。

検証: typecheck / 全Vitest **278ファイル・2,429件** / Vite build / App Store surface **120件**。Rust無変更。
資料: `reviews/2026-09-11-v3-shell-look`（総合fixture＋サイドバーfixture＋実測値＋スクショ）。
未受入: 信号機の縦位置（ネイティブ）、スクロールバーの出方（ヘッドレスでは再現せず）、
読書面の出入りと章またぎ、えるモードの紙の見え方、差分の行内ハイライトの扱い。

## 現在の区切り — 実機フィードバック11件の対応（2026-09-11）

実機で使いながら気になった点（`3.0気になるところ.md`）の11件を、5スライスで閉じた。
オーナー判断: 二段目の「確認」は外す（上部ナビ1本）／左上の左ペイン開閉は消す／
文字コードは1チップ統合／「読む」は全幅の見開き読書面／演出はタブとサイドバーまで。

- **ステータスバー（⑤⑥）**: ライトテーマで「改行LF」「文字コード」「開き直す」の文字が
  旧・暗色ステータス用トークン（`--status-text`）のままで沈んでいた（PNG画素実測 1.02〜1.03:1）。
  chrome 面の `--text` / `--text-muted` へ統一し **10.48:1**、詳細テキストの `opacity` を撤去して **4.98:1**。
  文字コードは**1チップの2群**（「この文字コードで読み直す」を先・「保存する文字コードを変える」を後）へ統合。
- **上部バー（①③⑧⑨）**: 二段目の「確認」（上部ナビと同じ行き先の二本目）と、左上の左ペイン開閉
  （サイドバー内の折りたたみ・畳んだ後のレールと三重）を削除。ドラッグ領域のダブルクリックで
  **最大化**（フルスクリーンではない）。「保存」は `activeDirty` を見ておらず常に押せたので
  `resolvePrimarySaveEnabled` に集約。
- **設定の文字サイズ（⑩⑪）**: 行ごとの「静かな一ページ」見本は LIVE PREVIEW（モック16）と重複していたため
  外し、**同じ値域へ接続した slider** を併設（数値入力は残す＝モック16の指示3）。
- **電子書籍（②④）**: 「読む」＝全幅の読書面（Reading Focus）。読書中も「書く」で編集へ戻れる
  （従来は上部ナビが全て無効だった）。見開きは**紙幅の計算漏れ**で1列になっていた
  （実測 836px/1列 → 916px/2列）。紙面455px・内側39px（モック04）。
- **お遊びテーマ（⑦）**: 「UI chrome は色収差なし」の除外を解除し、**タブとサイドバーまで**
  薄く載せる（CRT 0.9px/深海 5px・0.10）。ステータスと主要操作ボタンは据え置き。

検証: typecheck / 全Vitest **278ファイル・2,422件** / Vite build / App Store surface **120件**。Rust無変更。
資料: `reviews/2026-09-11-v3-status-chip` / `-top-chrome` / `-settings-type` / `-reader-spread` / `-joke-theme-reach`。
未受入: 実機での文字コード再読込、ダブルクリック最大化、読書面の出入りとページ送り、
ジョークテーマの実描画（WebGL はヘッドレスで写らない）、VoiceOver、200%文字、別窓同期。

## 現在の区切り — v3.0.0（TestFlight準備・2026-09-11）

- npm / Tauri / Cargo の版数を **3.0.0** へ更新（`tauri.conf.appstore.json` の build番号はオーナー管理のため未変更）。
- 検証: typecheck / 全Vitest **275 files・2,403 tests** / Vite build / App Store surface **117 tests** /
  Rust fmt・**385 passed・2 ignored**。
- 資料: `docs/releases/3.0.0-source-tag.release.md` / `3.0.0-app-store-release-notes.md`（TestFlightで確認する項目つき）。
- 署名pkgは未作成。Apple送信・TestFlight配布は未実施。次は build番号を更新して `npm run candidate:app-store-pkg`。

## 現在の区切り — 07・11レビュー対応（2026-09-11）

- **P1**: 「書く」でレビュー面だけ閉じ、提案は保持。面が本文を覆う間は `.editor-pane` を `inert` に。
- **P2**: レビュー導線に「領域を開示 → 再検証 → フォーカス（再試行）」を組み込み／低い窓の旧 `max-height` を撤去（640・680・200%でも未被覆0）／形式の往復で入力と対象を保持（`useExportDrafts`）。
- **受入テスト**: `null===null` で成功していた比較を実在＋包含＋単一性へ。往復の統合テストを追加。
- テスト 275ファイル/2,403件。資料: slice-07 / slice-11 のREADME。

## 現在の区切り — スライス11: 書き出しの形式ナビ（2026-09-11）

- 共通のダイアログ枠に**形式ナビ**（EPUB/PDF/HTML）を置き、同じ画面で形式を選べるようにした。
- 切替は「いまのを閉じて、選んだ形式の既存の準備を呼ぶ」だけ。3コマンドは残置、native別窓は新設していない。
- HTMLの本全体非対応の理由は維持。実アプリで PDF→EPUB→HTML の切替を実測（`role=dialog` は常に1つ）。
- 証跡 `docs/reviews/2026-09-11-v3-slice-11/`。テスト 274ファイル/2,393件。
- 残り: 05/12/13/18 は判断待ち。

## 現在の区切り — スライス07: 差分レビューの本文面化（2026-09-11）

- 生成された案を**主編集領域**（`.reference-editor-host`）で読む。右下のフローティングをやめた。
- 面は本文領域いっぱい（実測 1440×850 で 1440×850・offset 0,0）。長い差分は面の内側だけがスクロール（515 < 2669）。操作は下端固定（余白20px）。
- 機能は不変: 生成経路を増やさず、適用は既存の単一ライタのまま（構造テストで同一参照を固定）。反映後は消費されて編集面へ戻る。
- 証跡 `docs/reviews/2026-09-11-v3-slice-07/`。テスト 272ファイル/2,386件。
- 次: 11（形式ナビ統合）。05/12/13/18 は判断待ち。

## 現在の区切り — スライスE-2: 見開きの紙面・設定の境界とLIVE PREVIEW（04/16/17）（2026-09-11）

- 画面04: `.ebook-page-sheet` を紙面化（不透明な紙+1px罫線+影+角丸3px）、中央ガター 6px、`role="progressbar"` の進捗バー。
- 画面17: 可用性をカード1枚へ一本化し、境界4枚（外部AIへ送信しない/反映は自分で/勝手に保存しない/対象は選んだ文章）。
- 画面16: 保存済みの値だけで本文プレビュー面。行間は D06 のため 1.9 固定。
- 証跡 `docs/reviews/2026-09-11-v3-slice-e2/`。テスト 270ファイル/2,370件。
- 残り: 05（本の構成の専用面）・12（Import専用2ペイン）・13（復元の3領域）・18（使い方。Helpは英語のみの既決と衝突するため判断待ち）。

## 現在の区切り — スライスE-1: 検索・構造のヒント・書き出し（09/10/11）

- **09**: 一致範囲だけを `<mark>` で着色（backend の column を使用）、ファイルごとの件数バッジ、
  `total_files_matched` を Rust に追加して「2 ファイルに一致 · 3 件（走査 7 ファイル）」と区別表示。
- **10**: 構造のヒントを「何が起きているか／なぜ／該当箇所へ」の3要素カードに。
- **11**: 主操作を「書き出し先を選ぶ」へ統一（EPUB/PDF/HTML 3言語）、HTML に本全体が選べない理由を追加。

ローカル270ファイル・2,368件、cargo 383件が成功。
残り: **05本の構成・12Import・13復元・04見開き**の専用面（1スライスずつ）、形式ナビ統合は未決。
[実装と証跡](reviews/2026-09-11-v3-slice-e1/README.md)。

## 直前の区切り — スライスC: Local Assist の状態・文言・失敗（06/07/21/22）

- **07**: 反映後は反映ボタンを消し「未保存」の案内へ（同じ案を再度「採用」させない）。追加・削除の
  凡例（記号は DiffBody と同じ - / +）を追加。**本文面化は別スライス扱いのまま**。
- **21**: 停止の文言をモックへ（生成を停止／停止処理中…／生成を停止しました）。取消・ロック・
  古い応答の除外は既存契約のまま。
- **22**: 生の内部エラーを画面に出さない（別窓は短い一般文言）。サイドバーは内部メッセージを分類して
  **理由別の短い案内**を出し、**「もう一度試す」**（既存の送信経路）を追加。失敗面は `--conflict` の淡い面へ。
- **06**: 入力を下端固定（フォームの max-height:45vh と内部スクロールを撤去）＋対象枠に実データの抜粋。

ローカル269ファイル・2,365件、typecheck 成功。未受入: 実機での停止→停止処理中の一連（T-03）、
別窓の native 目視。[実装と証跡](reviews/2026-09-11-v3-slice-c/README.md)。

## 直前の区切り — スライスD: 保存の衝突（14）と画像プレビュー（24）

モックの要求に対し、**画面14は版カードが無く**、**画面24は倍率操作が無かった**。

- **14**: 「このウィンドウの編集」「ディスク上のファイル」の2版カードを追加。手元の文字数はバッファの
  実データ、ディスク側は本文を読まず `get_file_metadata` のバイト数と最終更新だけ（読めない数字は
  出さない）。notice「この段階では、どちらの内容も上書きしていません。」を追加し、**主操作を
  「差分を確認」**へ。外枠は 680×34×角丸13px、低い窓では操作列を固定。
- **24**: 倍率（25〜400%）を表示変換として追加。**100% = 画像1px = CSS1px**、**fit は 100% と別物**
  （大きい画像は100%未満、小さい画像は1で止める）。`overflow: auto` + `safe center` で
  拡大時も端へ到達できる。相対パスと形式を実データから追加（保存系の操作は置かない）。
- fixture は**ネイティブ境界だけ**をスタブし、実装と同じ経路で確認（680×581・カード各299px、
  2560×1708 が fit 43% → 150% で3840px・スクロール可）。

ローカル267ファイル・2,355件、typecheck・App Store surface 117件が成功。
未受入: 実機での外部変更からの到達（T-04）、画像の巨大/破損/透明/権限、低い窓での操作列。
[実装と証跡](reviews/2026-09-11-v3-slice-d/README.md)。

## 直前の区切り — 江戸彼岸をモックの明色へ（画面20）

モックが定義するテーマは `:root`・`.dark`・`.edohigan` の3つだけで、**江戸彼岸は明色**
（紙 `#fffcf8` / 地 `#fbf4f2` / インク `#453735` / アクセント `#975b68`）。実アプリの暗色「薄暮」
（`#2a2030`）は真逆だったため、オーナー判断（振り切る）でモック準拠へ作り替えた。えるモードも
暗色系グループから外し「机 `#fbf4f2` の上に紙 `#fffcf8`」へ。装飾は明るい桜空へ移し、
花びらを左右の余白だけに限定、前景オーバーレイの z をモーダルより下げた。

検証中に**えるモードの分割バーが窓の約38%（1440×850で323px）を罫線色で覆う**既存不具合を見つけて直した
（ライトテーマでも同様に出るためテーマ非依存）。[実装と証跡](reviews/2026-09-11-v3-edohigan-light/README.md)。

ローカル264ファイル・2,329件、typecheck・Vite・App Store surface 117件・cargo 383件が成功。
未受入: WebGL装飾の実機目視、VoiceOver、200%文字、別窓同期、再起動後の保持。

## 直前の区切り — 狭い窓のサイドバー（画面23）

≤1100pxではサイドバーを**表示上だけ**畳む（保存設定を持たず、利用者の開閉は幅が変わるまで優先）。
1440=開く／1024=畳む／トグルで開く／1440へ戻すと元の描画、を実測。`matchMedia` 購読のフックと
純関数に分離し、localStorage へ書かないことをテストで固定。[実装と証跡](reviews/2026-09-11-v3-compact-sidebar/README.md)。

ローカル264ファイル・2,326件、typecheck・Vite・App Store surface 117件が成功。
残差：1024で畳むとエディタ564pxで2面（モック目安630px）。container閾値780pxのためで、調整はオーナー判断。

## 直前の区切り — 設定の外枠寸法

設定ダイアログをモックの基準寸法へ（1100×752、左レール200px、レールのパディング23×14・項目min-height40px、
アイコンなし）。低い窓では縮む。実測は1440×850で1100×752、960×640で912×592（横スクロールなし）。
[実装と証跡](reviews/2026-09-10-v3-settings-frame/README.md)。

## 直前の区切り — focus ring・ガター境界・領域境界

レビュー指摘に沿って、**focusの自動検査が実UIのリングを見ていなかった**問題を閉じた。薄めたリング9箇所を
意味トークン `--focus-ring`（既定 `var(--accent)`）へ置換（light 2.40:1 → 5.85:1、shokou 2.11:1 → 4.30:1）。
`--cm-gutter-border` を全テーマ `var(--border)` に一本化（yakou 1.22:1 → 1.55:1 等）し、
**タブ群→文書・文書→ステータスの2境界だけ** `--border-strong`（約2.2:1）へ。証跡の日付もJSTへ是正。
[実装と証跡](reviews/2026-09-10-v3-focus-and-boundaries/README.md)。

ローカル261ファイル・2,314件、typecheck・Vite・App Store surface 117件が成功。

## 直前の区切り — 「実装途中感」3点の手直し

サイドバーの「No folder open」二重表示、上部ツールバーの「Hazakura Editor」二重表示、
プレビュー上端の空白（表示ツールバー行の右半分が単色98.8%で空いていた）を直した。
[実装と証跡](reviews/2026-09-10-v3-rough-edges/README.md)。

ローカル260ファイル・2,309件が成功。

## 直前の区切り — UI 第二調整（境界線の階層）

段階2（light/darkへモック配色、chrome面トークン新設）を外部レビューでAPPROVE。面の分離は実測1.06〜1.13:1で
「1pxの罫線が分離を担う」状態だったため、オーナー判断で **B案＝面の構造は変えず罫線だけ一段強める** を実施。
`--border` を紙面比 1.54〜1.55、`--border-strong` を 2.18〜2.22（差0.63〜0.68）へ全7テーマで揃え、
focus（`--accent` のoutline）3:1以上と `theme-palette.json` ＝ CSS `--chrome-surface` の同値を自動検査に固定した。
[実装と証跡](reviews/2026-09-10-v3-border-hierarchy/README.md)。

ローカル259ファイル・2,304件、typecheck・Vite・App Store surface 117件が成功。cargo test 383件も段階2で確認済み。
実描画で罫線の画素が `#dce2d9`→`#c7d2c5` に変わることを同座標で確認。

## 次のまとまった区切り — モック起点で引き直した優先順位

これまでの棚卸し（`v3-mock-gap-inventory.md`）は**自分の作業ログ起点**だったため、モック側の要求体系
（スライスA〜G／未決D01〜D16／横断シナリオT01〜T10）を通していなかった。画像モックと24ページを
起点に総当たりで突き合わせ直した結果が [モック再点検](reviews/2026-09-11-v3-mock-recheck/README.md)。

**訂正**: 「モック対応はすべて完了」ではなく、モックのスライスでは **C・D・E がほぼ未着手**、
**F は15の外枠のみ**、**G（native受入）と T01〜T10 は未実施**。

確定した事実（実証済み）:

- **モックが定義するテーマは `:root`（ライト）・`.dark`・`.edohigan` の3つだけ**。yakou/shokou/shinkai/crt は
  アプリ独自。そして**モックの江戸彼岸は明色**（`#fbf4f2`/`#fffcf8`/`#453735`/`#975b68`、PNG実測でも紙 `#fffcf8` が47.9%）で、
  実アプリの暗色 `#2a2030` と**真逆**（画面20）。旧棚卸しの「等価定義がない5テーマ」は edohigan について誤り。
- 江戸彼岸の装飾がモーダルより手前（`--z-crt-top`=1200 > モーダル100／パレット1100）＝既知の不整合。
- 専用面が丸ごと無い画面が5つ: 05（本の構成）・11（形式ナビ）・12（Import 2ペイン）・13（復元3領域）・18（使い方）。
- 14（保存の衝突）に**2版カードが無い**、17に**capabilityカードとprivacy-gridが無い**、
  09に**一致強調が無い**、24に**倍率操作が無い**、01に**補足カード・補助リンク・注記が無い**。

優先順位（効く順）:

| # | やること | 種別 |
| --- | --- | --- |
| 0 | ~~画面20の明暗を決める~~ → **モック準拠の明色で実装済み**（`2026-09-11-v3-edohigan-light`） | 完了 |
| 1 | ~~江戸彼岸オーバーレイの z~~ → **完了**（あわせてえるモードの分割バーも修正） | 完了 |
| 2 | ~~スライスD: 14の2版カード・24の倍率/fit~~ → **完了**（`2026-09-11-v3-slice-d`） | 完了 |
| 3 | スライスE（一部完了）: 09/10/11 は完了。**05・12・13 の専用面と 04 見開きが残り** | 実装（量大） |
| 4 | ~~スライスC: 06・07・21・22~~ → **完了**（07の本文面化のみ別スライス、`2026-09-11-v3-slice-c`） | 完了 |
| 5 | スライスF: 17・18 の説明面 | 実装 |
| 6 | T01〜T10 の横断シナリオ | 検証（実装後） |

各スライスは「1スライス＝1コミット＝証跡1ディレクトリ」の既存運用で進める。

## Held / Separate Work

- 本番のモデルDL・カタログ・開示はv3.1のC-1/C-2ゲート待ち。fixtureベースのC-1配管
  （Developer/GitHubレーン限定・カタログ未公開）は先に進めてよく、本番identityはリリース前に
  カタログ確定・実験を経てpinする。MLX M-0bも停止を維持。
- **v3.1 追加レーン C-3（オーナー決定 2026-09-22、スライス3まで実装）:** Apple-hosted 以外のモデルソース
  （Custom Models ディレクトリ、ユーザー明示登録の外部 resource folder、`.aimodel` 単体指定）を
  同じモデル管理・選択・生成経路で扱う。設計とゲートは
  [モデルソース抽象化](core-ai-model-source-abstraction.md) に固定した。C-1 / C-2 を止めず、
  app-managed Custom Models は既存 registry / UI / helper の選択・生成経路へ接続した。外部登録と
  security-scoped bookmark は次の独立スライス。任意URL取得・自動DL・モデル店は Non-Goal のまま。
- 新しい書体/行間/永続設定、native別窓、Importの確定前ステージ、画像倍率は別仕様。
- UI刷新とnative runtime再編・新SDK採用を同じ変更へ混ぜない。
- 保存済み原稿、既存Apply/Undo/no auto-save、R2-cの完了/取消mutex境界を広げない。
- App Store設定の既存未コミット変更を保持。署名・公開タグ・アセットを変更しない。

## Sources

- [現状](current-status.md) / [引き継ぎ](handoff.md)
- [v3製品計画](v3-product-completion-plan.md) / [版別方向](roadmap.md)
- [安全境界](security-boundary.md) / [Assist境界](assist-surface-strategy.md)
- [実機確認](smoke-checklist.md) / [公開前確認](release-pre-check.md)
- [v2.9品質履歴](reviews/2026-09-08-v2.9-quality-hardening.md) / [候補証跡](releases/2.9.0-source-tag.release.md)
