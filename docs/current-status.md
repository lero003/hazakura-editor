# Current Status

Status: Operational
Scope: v3.1開発状態、v3.0公開状態、実装証跡
Authority: High
Last reviewed: 2026-09-24

## Current State

- **外部レビューP2追補（2026-09-24、source検証済み）:** Background Assets取得中に再起動した
  プロセスは通知・snapshotから最新版のensure completionへ再接続する。旧版通知と操作世代を照合し、
  旧版をReady扱いしない。Local Assistの`busy` probeは65秒の期限まで再試行する。
  frontend 2710件・scripts 31件、Rust 477件pass / 3 ignored、native回帰テスト、型検査、
  Vite、App Store surface 132件、Rust fmt、`npm run build`が成功。**build 153はこの修正を
  含まない。次の署名済み候補でTestFlight受入が必要。**

- **3.1初回配布方針とP2是正（2026-09-23、source検証中）:** App Storeの初回モデル一覧は
  Gemma 4 12Bのみ。最低16 GB・推奨24 GBを表示する。E4B v2の資産と評価は履歴として保持し、
  現行catalogからは除外した。下記の「E4B v2を明示DL対象」の記述は変更時点の記録。
  検証失敗時のApple資産の削除→再取得、pack version・ファイル実体に結び付く検証記録、
  古い監視の状態反映防止を追加し、 focused Rust / UI回帰テストを通した。
  外部登録の永続bookmarkとhelperへの一時的なimplicit bookmarkも分離した。
  clean source `6e76b443`から署名済み3.1.0 build 149 pkgを作成し、署名・entitlementを
  ローカル確認した。後続の隔離ad-hoc sandboxでは外部E4B v2の登録・選択・再起動復元・
  streaming生成、試験用clone移動後の失効表示・System復帰・再指定後の生成を実操作で確認。
  `external_local`選択ボタン欠落と起動直後の一時`busy`残留を修正。clean source
  `df33a65a`からbuild 151署名pkgを作成し、app / extension番号一致、署名、digestを確認。
  元E4Bの15ファイルは生成前後のSHA-256が一致した。最終sourceの隔離プレビューでは
  3,600字のstreaming生成を停止し本文不変更を確認。その後Systemへ切替→E4Bへ戻して
  再生成がDiff提案まで完了した。別の生成中にはモデル選択が無効、停止後に復帰した。
  helper単体の通常生成も実E4B v2で候補を返した。同じ配布候補のTestFlight install、
  外部bookmark付きnon-streaming IPC、実ディスク切断は未受入。
  通常生成IPCのhelper待機をblocking workerへ移し、UIスレッドを塞がない経路に変更。
  Rust全体473件pass / 3 ignored、最終調整後の関連80件pass。build 151はこの変更を含まない。
  clean source `76d38284`からbuild 152署名pkgを作成し、app / extension番号一致、pkg署名と
  digestを確認。後続の選択済みモデル用「短い例文で試す」は、固定文だけを通常生成IPCへ渡し、
  request IDで取消・画面終了を扱う。応答モデルを照合し、文書は使わず変更しない。
  frontend 2708件、scripts 31件、Rust 477件pass / 3 ignored、App Store surface 132件、
  型検査、Vite build、Rust fmtと600px表示fixtureを確認。build 152にこの導線は含まれない。
  このsourceの`npm run build`も成功し、元bundle IDのプレビュー`.app`はmacOSで
  1153×739の表示窓を確認した（実モデル試用は未実施）。
  Apple送信・TestFlight installと同一署名候補の外部bookmark付き通常生成は未実施。

- **ローカル`npm run build`起動修正（2026-09-23）:** ad-hoc App Storeプレビューで
  起動時の`BAAssetPackManager.sharedManager`が`SIGTRAP`終了することを別IDコピーでも再現。
  プレビューだけApple-hosted transportを呼ばず、現行catalogの12B取得はTestFlightで試す案内へ変更。
  `npm run build`後の別IDコピーは署名検証と1280×820表示窓のsmokeに成功。後続ビルドの
  元bundle ID `.app`も`open -n`で起動し、ウィンドウ表示を確認した。
  通常生成IPCの非同期化後に再ビルドした元bundle IDでも、通常macOS権限の起動smokeで
  1280×820の表示窓を確認した。
  submitビルドのplatform経路はsource上維持。TestFlight取得の再検証ではない。

- **Core AI更新経路と設定（2026-09-23、source変更）:** build 147で12B pack v2のmanifestが
  アプリ固定の旧manifestと一致せず失敗する実機報告を受け、互換版は同じasset pack IDで更新可能な
  経路へ変更した。取得したpack内manifestの固定identity / runtime契約と全ファイルを検証し、
  最新版取得中は旧版を先に`Ready`扱いしない。E4B v2はsourceで明示DL対象へ変更。
  選択中モデルの更新が検証されたらhelperのpathも新版へ切り替える。
  設定は状態・操作・容量を見やすく分け、失敗時の復旧操作と更新確認を追加した。
  **build 147自体は未修正。新buildのApple CDN / TestFlight / 実機 / VoiceOver受入は未実施。**
  [表示fixtureと検証範囲](reviews/2026-09-23-core-ai-pack-update/README.md)。

- **E4B v2はローカル候補（2026-09-23）:** 元QAT checkpointからprovider PLE版を再変換し、
  Rust/Swiftのruntime契約、配布helper patch、固定manifestを更新。PLE3ファイルは元checkpointから
  独立再生成してSHA-256一致。6例×3回＋取消後の実helper評価は全件成功。
  `.aar`はローカル作成済み。サイズとSHA-256は下記の検証資料に記録。
  オーナーはv2のTestFlight配信成功を報告（この作業ではApple側を独立確認していない）。
  build 146のアプリ本体は旧v1を参照した。現行sourceのv2配信フラグは上記で有効化した。
  16 GB実機、AOT、v2を参照する新アプリbuildでの取得・生成、外部レビューは未受入。
  編集promptなしの短い会話はE4B v2 / 12Bともに成功したが、編集品質ではない。
  [直接会話の範囲](reviews/2026-09-23-core-ai-direct-chat/README.md)。
  参考文脈の短い命令で両モデルが対象本文の「青い栞」を「赤い栞」に変える例を生出力で確認。
  8,000字文脈は両モデルで生成エラー。校正9件の文脈あり/なし比較はE4B v2・12B・Systemで
  各9組の候補が一致し、保持チェックが通った。初回校正では参考文脈を送らず、再依頼では
  固定原文・依頼履歴を残して隣接本文を省く。実原稿/実機品質と他操作の文脈は未受入。
  [文脈probe](reviews/2026-09-23-core-ai-context-probe/README.md)。

- **実機フィードバック対応（2026-09-22）:** Local Assistを14px本文 / 13px補助表示へ縮小。
  常設の「再確認」を撤去し、選択時の自動probe・上部状態・同一モデル再選択による復帰へ変更。
  frontend 2,686件と表示用ブラウザー確認は成功。E4Bの日本語崩れはhelper生出力で再現し未解決。
  固定18件は以前の保存結果と一致。直近変更による退行はその範囲で未検出だが、品質受入ではない。
  [検証境界と次の調査](reviews/2026-09-22-assist-device-feedback/README.md)。

- **3.1審査資料は草案（2026-09-22）:** [掲載文パケット](releases/3.1.0-app-store-listing-copy.md)と
  [リリースノート / 審査メモ](releases/3.1.0-app-store-release-notes.md)を現行実装へ更新。
  英語JSONも3.1化し、未適用を維持。`8dffa835`からの署名universal app/pkgはローカル検証済み。
  これはTestFlight・審査・配信受入ではなく、実機確認と出荷範囲の決定が残る。
  候補build/path/SHAはGit対象外の`docs/internal/app-store-candidates/latest.json`に記録。

- **モデル設定の自己レビュー（2026-09-22）:** local modelをAssist pickerでも選択できるようにし、
  選択中local folder消失時のSystem復帰と、設定選択後のfocus喪失を修正した。再レビューの
  通常テーマfocus枠・消失localの内部ID表示も是正。frontend 2,686件、scripts 24件、surface 132件、
  型検査、App Store preview build / distribution probeはローカルで成功（CIとは別の証跡）。
  ローカルad-hoc preview 3.1.0でオーナー実機レビューへ進める。実操作・VoiceOver・
  実モデルmemory・sandbox / TestFlight受入は未確認。
  [自己レビューと実機確認項目](reviews/2026-09-22-model-settings-self-review/README.md)。

- **v3.1スコープ更新 — C-3（2026-09-22、オーナー決定・app-managed 選択接続まで実装）:** v3.1 に、Apple-hosted 以外の
  モデルソース（Hazakura 管理の Custom Models ディレクトリ、ユーザーが明示登録した外部
  resource folder、`.aimodel` 単体指定）を同じモデル管理・選択・生成経路で扱う **C-3** を加える。
  allowlist 前提を「ユーザーの明示登録」に限って広げる決定で、設計とゲートは
  [モデルソース抽象化](core-ai-model-source-abstraction.md) に固定した。1本目のスライスとして
  Rust のローカル bundle 解決・構造検証（`core_ai_local_models.rs`）を追加し、外部レビュー
  P1/P2 の是正で**ローカル契約を Swift `CoreAILocalResourceContract` と分離**した。
  複数スライスの初回レビュー是正 `2fd9df12` と再レビュー追加是正 `a7d19487` まで含め、両言語は
  共通 fixture spec `local-model-contract-cases.json` の35ケースを通す。bundle `metadata.json` の `assets.main` は
  検証済み `.aimodel` との完全一致を必須にし、`embedded_tokenizer=false` はloader生成前に拒否する。
  `embedded_tokenizer` の既定値trueはfield省略時だけで、明示`null`と型不正はRust / Swiftとも
  `malformed-bundle-metadata`にする。cacheは同一署名だけを再利用し、署名不一致または取得不能なら
  replacement modelの生成前に旧entryを解放する。replacement load失敗後も旧entryを保持し直さない。
  symlink は root 配下の全 component を拒否し、
  scan は壊れた候補も理由付きで返す。スライス2では `app_data_dir()/CoreAICustomModels` を
  app-managed の保存場所として既存 `CoreAiModelStore` / IPC / UI へ接続し、正常候補を
  `detected`、壊れた候補を安定 `errorCode` 付きで一覧へ出す。スライス3では検証済み候補だけを
  Rust-owned ID で選択・復元し、`core_ai_local` wire から helper の local contract を再検証して
  `CoreAIKit` の production prompt / generation profile / cache 経路へ接続した。起動時に bundle が
  消失・破損していれば System へ fail closed する。Apple-hosted の download / cancel / delete は維持し、
  local model を asset 管理へ入れない。外部 resource folder は明示フォルダ選択、read-only bookmark保存、
  Rustとhelperでの再解決・再検証、登録解除までsource接続した。Local Assistのモデルメニューから
  管理ページにも移れる。Custom Modelsフォルダを開く / 明示再スキャンする UI は未接続。
  C-1 / C-2 と現在のTestFlight前レビューを止めない。任意URL取得・自動DL・モデル店は Non-Goal。
  スライス3時点ではsource接続だけであり、外部フォルダの実登録・bookmark復元・helperでの
  実 local model の load / 生成、built app、VoiceOver、TestFlight の証跡はなかった。
  後続の隔離ad-hoc sandbox実操作の到達範囲は冒頭を参照。スライス3時点の検証は
  frontend 2,677件、scripts 24件、Rust 456件（2 ignored）、
  Swift XCTest 61件 + Swift Testing 4件、surface 132件と production distribution helper build が成功。
  2026-09-23の外部フォルダ追加後はfrontend全体とfocused、Rust 467件pass / 3 ignored、
  Swift XCTest 66件 + Swift Testing 4件、型検査、Vite、surface 132件、配布用helper buildを確認。
  App Store sandboxプレビューではCore AI helperを含む3 helperのinherit署名と親appのad-hoc署名が通った。
  上記の実機受入は引き続き別ゲート。
  [初回証跡](reviews/2026-09-22-v3.1-c3-local-model-resolution/README.md)、
  [レビュー是正証跡](reviews/2026-09-22-v3.1-c3-local-contract-followup/README.md)、
  [registry / UI 接続証跡](reviews/2026-09-22-v3.1-c3-custom-model-catalog/README.md)、
  [スライス1〜3 外部レビュー資料](reviews/2026-09-22-v3.1-c3-multi-slice-review/README.md)。

- **TestFlight前 外部レビュー追補（2026-09-22）:** `aac6e900`へのP2 6件を閉じた。
  streaming markerの部分露出/古い最終候補、2画面のcatalog競合、manifest解決中cancel、paused後の
  監視停止、選択中modelの削除失敗、pickerのfocus再取得をそれぞれ回帰テストで固定した。
  設定は現在model / 物理メモリ、ready前の「インストール後」サイズ、Systemの未確認表示、削除確認、
  既定で閉じた「直近の生成記録」へ更新。frontend 2,674件、scripts 24件、Rust 427件
  （2 ignored）、Swift 52件、surface 132件、型検査、Vite / App Store preview buildは成功。
  実装commit `a16b0971`のPR #52 Quality run `35664620124`はfrontend / nativeとも成功し、
  merge stateは`CLEAN`。**built appのキーボード/VoiceOver、sleep/wake、実Background Assets、
  TestFlightは未確認。**
  [追補証跡](reviews/2026-09-22-testflight-review-followup/README.md)。

- **Core AI 12B source接続（2026-09-22）:** App Storeレーンの固定catalogへGemma 4 12Bを
  追加し、E4Bと同じApple-hosted download / 検証 / 選択 / 削除経路へ接続した。
  設定ではdownload量、展開後使用量、推奨メモリ、license要約を表示し、物理メモリが推奨値を
  下回る場合はdownload開始前に確認する。モデル状態は購読後にsnapshotを取り、後着した古い
  snapshotで進捗を巻き戻さない。12Bが復唱する完全な外側prompt envelopeだけを安全に除去し、
  実モデル18 fixtureは変更前14/18のmarker失敗から変更後18/18全check通過になった。
  ローカルarchiveは9,148,924,300 bytes。固定SHA-256は外部レビュー用証跡へ分離した。
  frontend 2,666件、scripts 24件、Rust 424件（2 ignored）、Swift 49件、surface 131件、
  型検査、Vite build、ad-hoc App Store preview build、Vite fixture目視は成功。
  **12B archiveのApple upload / processing、CDN、32 GB対象機TestFlight、VoiceOverは未実施。**
  [外部レビュー用証跡](reviews/2026-09-22-core-ai-12b-catalog/README.md)。

- **PR #52 のmacOS 26 SDK対策（2026-09-22）:** macOS 27専用Background Assets selectorを
  `__MAC_OS_X_VERSION_MAX_ALLOWED >= 270000`でcompile guardし、古いSDKはunsupported fallback
  だけをコンパイルする。Quality run `35655597653`はfrontend / nativeともに成功し、
  `runs-on: macos-26`でguardを実証した。外部レビュー前なのでまだmainへ取り込まない。

- **外部レビュー2巡目（2026-09-21）:** `540affc7`へのP2/P3を閉じた。ページ見出しへ
  着地した後のTabがヘッダーへ戻る問題は、フォーカストラップで「ダイアログ内の
  `tabIndex=-1` の受け皿」と「ダイアログ外へ抜けた」を区別し、受け皿のDOM位置から
  前後へ進めるようにした（端の折り返しとダイアログ外の扱いは不変）。かなメニューの
  「おんでばいますもでる...」も訂正。回帰テストはunitに加え、実`PreferencesDialog`+
  `useModalKeyboardGuard`の組み合わせで「着地→Tab」「着地→Shift+Tab」まで見る。
  旧挙動へ戻すと2件落ちることを確認済み。Rust 424件（2 ignored）、frontend 298 files /
  2,662件、project script 24件、型検査、Vite buildは成功。built appでのフォーカス実機確認は
  未実施。**`gh pr merge --match-head-commit`はHEAD一致のガードでfast-forward指定ではない**
  ため、SHAを保つFF-onlyはローカル`git merge --ff-only`→`main` pushで行う。
  [証跡](reviews/2026-09-21-review-followup-models-page/README.md)。

- **外部レビュー追補（2026-09-21）:** モデルページのP2 2件を閉じた。ページ切替後は
  見出しへフォーカスを移し（ヘッダーの選択から来たときは選択を維持）、生成設定は
  「購読 → スナップショット」の順にして、取得中に通知が届いたら取得結果を採用しない。
  あわせて`MENU_ON_DEVICE_MODELS`を追加し、システムメニューから設定本文を経由せず
  モデルページを直接開けるようにした。Rust 424件（2 ignored）、frontend 297 files /
  2,659件、project script 24件、surface 130件、型検査、Vite build、App Store previewの
  `npm run build`は成功。両修正とも外すと新規テストが落ちることを確認済み。
  **CIはこのブランチでは走らない**（`quality.yml`は`pull_request`と`main` pushのみ）ため、
  マージ前はPR起動かmain取り込みでquality / nativeを動かす。built appのメニュー実表示・
  フォーカス、VoiceOver、最大Dynamic Typeは未実施。
  [証跡](reviews/2026-09-21-review-followup-models-page/README.md)。

- **オンデバイスモデルの独立ページ（2026-09-21）:** モデル管理をPreferencesダイアログの
  独立ページ（`models`）へ移した。モデル一覧（状態・サイズ・資産バージョン・開始/進捗/
  再開/取消/削除/選択）、保存先が選べないことの説明、直近の生成記録、扱えるモデルの
  境界を1ページに置き、設定本文には入口だけを残す。保存先は選ばせず、自動ダウンロード・
  起動時スキャン・Rust command契約・helperへ渡す内容は不変。frontend 297 files / 2,654件、
  project script 24件、App Store surface 130件、型検査、Vite build、Vite fixtureの実表示
  （日本語light / 英語dark / 未配布の空状態）は成功。built appの表示・VoiceOver・
  最大Dynamic Typeは未実施。2026-09-22にlicense要約と展開後使用量を追加したが、notice本文を
  開くUIは未実装。
  [証跡](reviews/2026-09-21-on-device-models-page/README.md)。

- **Core AI生成設定の可視化（2026-09-21）:** helperが返す`usage`をRustが保持し、設定の
  オンデバイスモデル欄に「直近の生成記録」（出力上限 / サンプリング要求 /
  サンプリング実効 / 直近のトークン数 / 直近のモデル）を表示する。値はwebview側の写しでは
  なくRustの記録から読む。まだCore AIで生成していない起動は空状態を出し、記録はプロセス内のみで
  保存・送信しない。モデルへ渡すprompt契約・生成オプション・Apply経路は変更していない。
  Rust 422件（2 ignored）、frontend 2,649件、project script 24件、App Store surface 129件、
  型検査、Vite build、App Store previewレーンの`npm run build`は成功。実Core AIでの観測と
  built appでの表示確認は未実施。
  [証跡](reviews/2026-09-21-core-ai-generation-profile/README.md)。

- **Core AI配布前基盤（2026-09-20）:** App Store / TestFlight buildへmacOS 27+の
  Core AI production adapterを別helperとして同梱し、設定のモデル管理、Local Assist窓の
  選択、Rust-ownedの永続選択を接続した。System helperはmacOS 26互換を維持する。
  App StoreレーンはE4Bをcatalogへ接続し、2026-09-22に12Bも追加した。Apple-hosted managed downloader extension、App Group、
  `BA*` keys、`AssetPackManager` download / progress / cancel / resume / remove / restart復元を追加した。
  Developer production catalogは空。署名候補、12B archiveのApple upload、TestFlight受入、
  本番モデル採用の証跡ではない。
  最終のSwift 24件、Rust 417件（2 ignored）、frontend 2,646件、project script 14件、
  App Store surface 129件とローカル`npm run build`は成功。
  [配布前記録](reviews/2026-09-20-core-ai-distribution-preflight/README.md)。
  外部レビューP2追補でDeveloper明示テスト選択を維持し、App Storeは指定を無視するよう修正。
  モデル管理初期化の障害は設定へ隔離し、通常起動を継続する。切替の保存失敗時は旧モデルを保持。
  再レビューR1 / R2ではprobeをworkerへ移し、生成中は即時busy、backendとmodel IDは同じ
  snapshotを使用。言語変更でも通知購読を維持し、会話を保持する「再確認」を追加した。
  最終の全Rust 417件（2 ignored）、frontend 2,646件、surface 129件、`npm run build`と
  local previewのdistribution probeは成功。遅延中の実ウィンドウ操作・CDN受入は未確認。
  G1（複数窓同期）とG2（signed manifest / safe path / size / SHA検証済みReady）はsource実装済み。
  本番候補はGemma 4 E4B（標準、16 GB Mac受入候補）とGemma 4 12B（高品質比較、32 GB以上）へ
  固定し、community変換物のcommit/file digest、CoreAIKit runtime、再現可能なBackground Assets
  stage/manifest/`.aar`準備処理を追加した。[候補・再現手順・残ゲート](core-ai-production-models.md)。
  以前「Xcode 27.0 `ba-package`の拡張子判定不具合」とした判定は訂正。同じtoolchainでも失敗は
  Codexのseatbelt sandbox内だけで再現し、通常shellでは相対/絶対、`-o`/`--output-path`、
  default/明示`package`の全CLI形式が成功する。manifestは実物の`ba-package template`と照合して
  有効で、`package`は`sourceRoot`へのchdir前に出力pathを解決するため絶対pathへ修正した。
  sandbox外でE4B（5,431,767,276 bytes）と12B（9,148,924,300 bytes）の`.aar`をローカル生成した
  （`.hazakura/coreai-production/`、Git対象外）。再生成profileは両targetとも
  `OSX`、正しいID、App Group、有効期限を満たし、profile内certificateとApple Distribution identityも
  一致した。3.1.0 build 143の署名app/pkg、entitlement probe、deep verify、installer signatureは成功。
  ただしbuild 143のuploadは、extension署名にprofileの`com.apple.application-identifier`が
  無いとしてApple 90886でTestFlight不適格になった。`codesign`はprofileを読まないため、
  署名scriptはprofileからapplication/team identifierを導出してextensionへ署名し、署名後に
  `codesign -d`で読み返して不一致なら失敗するよう修正した。同じ条件は
  `REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution`も検出する。
  既存bundleへの再署名とprobeで修正を確認済み。同一build番号は再uploadできないため、
  差し替えcandidate（3.1.0 build 144）はAppleの処理まで通り、90886の修正を実証した。
  `.aar`のTransporter uploadはApp Store Connect側の
  `-19243` / 400 invalid valuesで未完了だったが、`altool`で実APIを叩いて原因を特定した。
  App Store Connectは`assetPackIdentifier`内のピリオドを拒否する（`filter[assetPackIdentifier]`が
  400 PARAMETER_ERROR）。E4B/12Bのasset pack IDを`hazakura-coreai-gemma4-e4b-v1` /
  `hazakura-coreai-gemma4-12b-v1`へ変更し、lockの検証でピリオドを禁止、`.aar`も再生成した。
  新IDを参照するbuild 145も作成済み（未upload）。
  [E4B handoff](reviews/2026-09-21-core-ai-apple-hosted-e4b/README.md)に記録。
  Apple processingは未実施。`coreai-build`も利用できずAOTは未完了。ローカル`.aar`生成は完了したが、Apple CDN、
  TestFlight実機取得、production helperからのmaterialized path読込、品質採用、App Store出荷を
  確認した状態ではない。
  E4Bと12BはいずれもM4 Max / 128 GBのローカルproduction helperでloadと短い日本語校正を
  通したが、16 GB / 32 GB対象機の性能・bake-off・配布受入を代替しない。

- **3.1.0開発版へ移行（2026-09-20）:** npm / Tauri / Cargo / lockfileの版を
  `3.1.0`へ揃え、[App Storeリリースノート草案](releases/3.1.0-app-store-release-notes.md)を開始。
  現時点では署名済み候補・TestFlight・申請・タグ・公開のいずれでもない。開始時点は
  Developer固定fixture、空catalog配布adapter、本番候補asset準備までだったが、現在は上記の
  E4B internal TestFlight用source接続まで進んだ。Apple uploadと海外展開の残ゲートは未完了。
  並行するApp Store bundleVersion変更は候補証跡として扱わない。

- **Core AI Phase 1（2026-09-20）:** 固定Qwen3-0.6BをRust-owned `core_ai_test` で選び、
  既存Local Assistのstream / Proposal / Diff / 明示Apply / Undo / Cancelへ接続した。
  専用QA appでCore AIとSystemへの復帰を実機確認し、Proposalは実際の`modelId`を保持・表示する。
  任意path / URL / import、製品内変換、network fallback、auto-apply / auto-saveは追加していない。
  Qwen出力品質は不合格。本番identity/digestは別のGemma 4候補lockへ進んだが、
  asset配布・検証済みReady・削除は未接続。
  固定Qwen fixtureはApp Storeへ含めない。App StoreのE4B catalogとは別のDeveloper経路を維持する。
  [Phase 1記録](reviews/2026-09-20-core-ai-phase1/README.md)。

- **Local Assist表示整理（2026-09-20）:** 対象要約・依頼チップ・一体化した入力欄へ整理し、
  説明の重複を減らした。送信横にSystem 1件でも開けるモデル選択枠を追加。
  フロント全2,620テストと最小サイズのブラウザーfixtureを確認。通常利用者向け切替は未接続。
  [表示・検証記録](reviews/2026-09-20-local-assist-polish/README.md)。次はnative窓の操作・IME・VoiceOver確認。

- **v3.1俯瞰レビュー追補（2026-09-20）:** 保存言語のstorage例外時fallbackと表の祖先lang保持を修正。
  [修正・検証記録](reviews/2026-09-20-v3.1-overview-followup/README.md)。
  [テスト用Core AIモデル](core-ai-test-model.md)は約347 MBのQwen3-0.6Bを実生成まで確認したが、
  校正精度は不合格。現在のApp Store source catalogはE4Bを含むが、asset未uploadのため
  TestFlight実生成は未確認。本番採用と海外展開の残ゲートを維持する。

- **v3.1開発へ移行（2026-09-19）:** 次の版をCore AIの実利用と海外App Store展開の
  二本立てとして開始。最初のI-0ソース／静的棚卸しは
  `docs/international-launch/` に集約した。英語ストア文案はproposalで、Connect設定、
  対象地域、価格、契約、公開Web、署名候補の英語受け入れは未実施。Core AI本番C-1/C-2も
  identity・manifest・配信/AOT・bake-offのゲート待ち。I-0aではメイン窓とLocal Assist窓の
  HTML `lang`を表示言語へ同期し、`kana`は日本語として `ja`へ対応させた。生成・保存・
  Assist能力判定は不変。外部レビューのP2・P3も同じスライスで閉じ、ルートの同期はUI chrome
  用として、本文を描く面（編集・プレビュー・読書・Local Assistの入力/生成途中・
  候補レビュー・参照面・サイドバー）へはUI言語を継承させず「言語不明」を持たせ、
  本文へ差し込むアプリ文言（画像ブロックの案内は `ja`、ページ区切り・テーブル枠・
  L Modeタスクのラベルは `en`）は、それぞれ実際の言語を宣言する。
  メイン窓・Local Assist窓はReact初回描画の前にも保存済み表示言語を反映するが、
  Agent窓はchromeが英語固定なので `en` のまま。テーブル枠の外部再レビューP2では、
  英語ラベルを持つ枠から利用者の表本文へ `en` が継承しないよう、子 `table` を
  `lang=""` へ戻し、raw HTMLの明示言語は保持した。I-0bでは英語主要導線を静的に棚卸しし、
  英語UIでも日本語を主表示していた致命的フロントエラー復旧面を英語／日本語へ分離した。
  外部レビューのfalsy throw値P2も、エラー発生状態をcatch値から分離して閉じ、再レビューは
  P0 / P1 / P2 / P3なし。Quality run `#35466308356` はfrontend / nativeともにsuccess。
  次はbuilt appの英語実表示。bundleの言語宣言は署名候補確認まで保留する。
  詳細は [current-work](current-work.md) と
  [I-0a証跡](reviews/2026-09-19-v3.1-i0a-document-language/README.md)、
  [I-0b証跡](reviews/2026-09-20-v3.1-i0b-english-major-flow-static-audit/README.md)。

- **v3.0.3を実機確認して申請（2026-09-18）:** 編集面のスクロールバー不具合を直した不具合修正版。
  3 件を修正した。(1) 右ペイン表示時、本文の右端でスクロールバーをつかむとスクロールせず、
  代わりにペイン幅の変更が始まっていた。原因は右ペインのリサイザ `.pane-resizer::before` の
  透明な当たり判定が本文側へ 4px 食い込んでいたこと（当たり判定が描画順で手前になる）。
  張り出しを右だけに限定し、左隣（本文・ファイル一覧の右端＝スクロールバーのある場所）へは
  広げないようにした。(2) 一気に最下部まで引くと末尾より少し上で止まっていた。原因は
  編集→プレビューの同期ガードが固定 80ms でドラッグ中に切れ、プレビューの古い比率が
  本文の scrollTop を書き戻していたことと、CodeMirror の行高さ再計測で総高さが伸びて
  ドラッグ終了位置が末尾でなくなること。ガードを自己延長（150ms）に揃え、トラック下端で
  終わったドラッグだけ再計測後に底へ寄せ直す。(3) スクロールバーを離してフォーカスが
  戻るとき、エンジン / CodeMirror が位置を書き換えて画面がキャレットの行へ引き戻される
  ことがあった。ドラッグ位置を 1 フレームだけ取り戻し、ユーザーの新しい操作があれば降りる。
  同種の当たり判定は fixture で到達できる主要面について総当たり検査し、他に該当なし
  （[原因・実測・検査手順](reviews/2026-09-17-scrollbar-drag/README.md)）。版数は npm / Tauri /
  Cargo / package-lock を `3.0.3` へ揃えた。提出文案は
  [3.0.3 App Store notes](releases/3.0.3-app-store-release-notes.md)、作業記録は
  [current-work](current-work.md)。オーナーが実機（WKWebView）で確認し問題なしと報告、
  その報告で申請する。署名 pkg は build 140 を作成済み（ローカル候補記録
  `docs/internal/app-store-candidates/latest.json` は 2.9.0 / build 125 のままで未更新）。

- **v3.0.2を提出用に準備（2026-09-16）:** 公開済み3.0系で残っていたmacOSメニューバーの明滅を直した不具合修正版。原因は2経路で、本文更新のたびに `set_title` のIPCが走っていたこと（`useWindowTitle` の `activeTab` オブジェクト依存）と、フラグだけの変化でも `app.set_menu` でメニューバー全体を作り直していたこと。メニュー状態は「同一state→何もしない / フラグのみ→delta適用 / ラベルか項目集合→再構築」に変更した。あわせて、App Store laneに存在しないAgent項目をin-placeが要求して再構築へ戻る問題、モーダル中のテーマ／チェック項目でネイティブ表示だけが変わる問題も塞いだ。版数はnpm / Tauri / Cargo / package-lockを `3.0.2` へ揃えた。提出文案は [3.0.2 App Store notes](releases/3.0.2-app-store-release-notes.md)、作業記録は [current-work](current-work.md)。実機確認（入力中のちらつき、モーダル中のメニュー操作）と署名pkg作成は別工程。3.0.1はオーナーがストア申請済みと報告しており、公開build番号との対応は未確認。

- **v3.0.0を公開（2026-09-14）:** オーナーが公開を報告。Mac App Storeの製品ページでバージョン3.0.0を確認（更新表示は確認時点で約1時間前）。公開build番号・公開buildとソースの対応・Apple側の処理/審査の詳細・TestFlightでの個別実機受入結果は独立未確認。ローカル候補記録（`docs/internal/app-store-candidates/latest.json`）は2.9.0 / build 125のままで、v3.0.0 pkgの書き戻しはない。未コミットで残っていたv3最終調整は区切りごとにコミットし、GitHubソースタグ `v3.0.0`＋Release（ソースのみ・バイナリなし）を作成、READMEと公開画像もv3へ更新し、既定ブランチ `main` も v3.0.0 の状態へ同期した。詳細は [3.0.0候補記録](releases/3.0.0-source-tag.release.md)。

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

- **江戸彼岸の意匠調整（2026-09-12）:** 明色パレットを維持し、全面の葉影・暗い起動演出を枝花と花びらへ置換。
  Preview/Readerの暗色時代の指定と設定の見本・説明も整合。全2,486件・型検査/Vite・surface 125件成功。
  nativeの動き・操作は未受入。[比較画像と検証範囲](reviews/2026-09-12-v3-edohigan-refinement/README.md)。

- **分離窓のテーマ色修正（2026-09-12）:** Local Assist 窓の江戸彼岸背景が暗色時代の固定色のまま残り、
  本文が 1.28:1 まで沈んでいたのを修正（明色テーマの `--bg` へ）。全7テーマの窓面コントラスト契約を追加。
  全2,487件・typecheck/Vite・surface 125件が成功。[前後画像と実測](reviews/2026-09-12-v3-assist-window-theme/README.md)。

- **v3 Local Assist基盤（2026-09-12）:** LA-1aでSystemの利用可否と生成能力を分離（四態wireと文言は不変、
  能力失敗は `unsupported_language`）。swift test 16件、live/fixtureビルド、実機live生成、cargo 385件を確認。
  27 SDKが無いため27固有APIの照合と評価は未実施。
  [検証と残確認](reviews/2026-09-12-v3-la1-availability-capability/README.md)。

- **v3最終UI調整（2026-09-12）:** 新規作成・読書復帰・検索候補・書き出し終了の操作継続を修正。
  ブラウザ確認と全2,479件、型検査/Vite、App Store surface 125件が成功。native再ビルド・実機受入は未実施。
  [今回の検証範囲と画像](reviews/2026-09-12-v3-final-ux/README.md)。
  続けて書き出しの面・余白、設定の文字見本の整列・外枠固定を調整。
  [デザインの比較記録](reviews/2026-09-12-v3-design-polish/README.md)。

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
- **UI 段階2:** light/darkへモック配色を反映（本文`#24362d`/accent`#356b50`/境界`#dce2d9`、darkは`.dark`ブロック）。
  chrome（ツールバー・タブ・ステータス）を `--chrome-surface` として全7テーマへ新設、サイドバーは `--nav-surface` のまま。
  透明タイトルバー色も追従。実測で面の分離は1.06〜1.13:1、accent面の文字を全テーマ検査しyakou/crtの不足を修正。
  [証跡](reviews/2026-09-10-v3-theme-stage2/README.md)。
- **確認:** ローカル259ファイル・2,269件、typecheck・Vite・App Store surface117件・cargo fmt・cargo test 383件が成功。
- **UI 第二調整:** 罫線の階層を全7テーマで調整（`--border` 紙面比1.54〜1.55、`--border-strong` 2.18〜2.22・差0.63以上）。
  focus（`--accent` outline）3:1以上と `theme-palette.json`＝CSS `--chrome-surface` を自動検査に固定。
  実描画の罫線画素 `#dce2d9`→`#c7d2c5` を同座標で確認。[証跡](reviews/2026-09-10-v3-border-hierarchy/README.md)。
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

> 2026-09-14 に公開された（上部の公開記録を参照）。以下は候補時点の記録。

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

- **2026-09-06 source follow-up:** Local Assistは別ウィンドウを標準入口に戻す。
  会話欄を縦に広げ、入力欄を下部へ固定。対象詳細・説明・定型依頼は初期状態で
  折りたたみ、進行状態は会話欄へ集約。mainのDiff確認と明示反映は維持する。
  実モデル・native窓の往復・IME・VoiceOverの検証は残る。公開版更新ではない。

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: **`2.8.0`** across npm, Tauri, Cargo, and
  lockfile metadata. A signed local universal package is prepared; upload,
  approval and publication remain unverified. User-confirmed **Mac App Store publication**
  of `2.6.2` remains the closed store line (2026-08-28; staged rollout). Prior published lines include
  `2.4.0`, `2.3.0` (recipe/resume quality pack) and `2.0.0` (Book Scope Alpha).
  Do not rewrite tags. Local package provenance for the frozen `2.7.0` candidate lives in ignored
  `docs/internal/app-store-candidates/latest.json`.
- **v2.5 is released and closed** (user-confirmed). The workspace control and
  delivery-clarity evidence below is historical release evidence, not an open
  upload, TestFlight, tag, or publication gate. Plan: `docs/v2.5-plan.md`.
- **v2.6 A-1–A-4 source work is merged on `main`.** Local Assist pins the
  tab/session/range/original, keeps follow-up instructions on that target, and
  applies only the reviewed Diff proposal through one stale-checked buffer
  write. A previous post-apply Review Bar state is cleared and the same proposal
  is not presented for a second confirmation. This is local source work, not a
  release claim. The merged A-4 source candidate tightens detached-window
  narrow Diff layout and makes Diff semantics, cancellation, and availability
  probe state explicit. Physical macOS interaction checks remain separate from
  source, package, TestFlight, and publication claims.
  Plan: `docs/v2.6-plan.md`; queue: `docs/current-work.md`.
- **MLX M-0a preflight is implemented on `main`.** The helper keeps one
  immutable, process-local `SystemLanguageModel.default` across availability,
  streaming, and non-streaming calls, while creating a fresh
  `LanguageModelSession` for every request. Generate / streaming stdin carries
  a Rust-owned `backend: "system_default"`; a missing field remains compatible
  with older Rust, while `coreai`, `mlx`, and unknown values return
  `unsupported_backend` before model invocation. TypeScript / public Tauri APIs,
  prompts, sanitizer, candidate JSON, explicit Diff Apply, and System-only
  availability probe are unchanged. No MLX dependency, model load/download,
  storage, path/URL field, settings UI, cloud fallback, remote code, or App Store
  feature exposure was added. Design: `docs/mlx-m0-preflight-design.md`.
  M-0b stays stopped until C-2 and an Xcode 27 / macOS 27 build lane exist;
  this is not `MLXLanguageModel` compile or runtime proof.
- **v2.7.0 is the frozen local candidate lane.** It carries the completed
  M-0a System-boundary maintenance slice without adding a user-facing MLX
  feature. A local `2.7.0` / build `123` package exists and its SHA-256 is
  recorded only in ignored `docs/internal/app-store-candidates/latest.json`.
  The owner plans to send it to App Review; upload, TestFlight processing,
  approval, publication, and full physical UI validation remain unconfirmed.
  The package was produced before the v2.7 tree was committed, so the internal
  note records dirty-source provenance rather than claiming a clean source
  commit.
- **v2.8.0 local release candidate is prepared.** Detached conversation-first
  Local Assist and M-0a/H-1 are integrated. Signed universal package, source
  gates and remaining native smoke: `docs/releases/2.8.0-source-tag.release.md`.
  U-3/U-4/G-1 are deferred; C-1/C-2/M-0b remain HOLD.
- **v2.6 source candidate** A-4 finishing is merged at `b40bd217`. The 2.6.1
  local candidate HEAD is `6ff22dad` (theme/Preview polish plus App Store
  `bundleVersion` 119). `2.6.2` is the right-pane ownership candidate on this
  worktree. The review branch and its old Draft PR #34 are
  historical and deleted. Mac App Store publication of `2.6.2` is
  user-confirmed (2026-08-28; staged rollout). A GitHub source tag and
  physical-device Assist smoke remain separate gates.
- **v2.4 Book depth is closed / shipped** in the `2.4.0` line: OKF v0.2 pin,
  compact Book toolbar, B-1 chapter Diff, book-like starter. Residual Book
  items (B-2 display TOC, …) are parked, not the v2.5 main queue.
- **縦書き** stays deferred. **anydoc** is evaluation only. **Core AI**
  allowlisted writing models remain later than stable v2.6 conversational apply.
- **OKF review/scaffolds now pin v0.2 commit `3fcbb9f…`.** v0.2 optional
  provenance/trust/lifecycle/attestation families, including `usage_window`,
  are accepted as inert optional data.
  v0.1 bundles, legacy `timestamp`, and body `# Citations` remain best-effort
  readable; no migration, trust tier, stale evaluation, or attester/executor
  execution was added. New starter roots emit `okf_version: "0.2"` without
  fabricated provenance. The book-like starter now makes the whole shape
  visible through four chapter roles and overview / character / setting notes;
  it remains an illustrative scaffold, not an OKF or Book Scope chapter-order
  contract.
- **Book rows now expose explicit per-chapter change review.** Available rows
  activate/reuse the normal chapter tab and compare its current editor buffer
  with that chapter on disk through the existing buffer-vs-disk Diff. Dirty
  tabs therefore win. Unavailable rows are disabled; the action does not save,
  apply, create a second buffer, or change Book/OKF persistence. Repeated review
  requests serialize chapter opening, and only the newest request may enter
  Diff, so an older slow open cannot reclaim the review target afterward.
- **v2 Book Scope Alpha spine is implemented in source.** The existing left
  sidebar now switches between Files and Book. Users explicitly select up to
  100 Markdown chapters, keep an app-private per-workspace ordered tree, reopen
  that scope after relaunch, and switch chapters through the existing single
  active editor buffer. Rust validates relative paths, workspace containment,
  Markdown/text eligibility, and symlink/file identity. Missing or externally
  moved chapters remain visible as unavailable until rechecked or explicitly
  removed. Quiet group labels and indentation show saved hierarchy; arrow moves
  stay inside the current parent group. Reader, PDF, and Rust validation consume
  the same tree in preorder. Existing flat v1 settings migrate without changing
  order as root-level chapters; hierarchy is adopted only after an explicit new
  suggestion is saved. No workspace manifest, source rewrite, background
  indexing, or OKF semantic expansion was added. Whole-book reading/export are
  separate, explicit layers described below.
- **Book Scope can now create an explicit chapter suggestion draft.** The user
  starts one bounded, cancellable OKF disk snapshot from the Book view. Root
  and nested `index.md` inline links lead the proposed tree, while ATX section
  headings become display groups. The current adapter resolves safe relative
  links and OKF's bundle-root `/...` form without storing an OKF version or type
  in the Book tree. A default-on, explicit option includes the root index first
  and each linked nested index immediately before its local chapters as
  cover/contents candidates. The option can be disabled, and every index can
  still be unchecked individually in the draft.
  Remaining readable `.md` files follow in stable path order; `log.md` and
  unreadable files stay out. The result remains an editable checkbox draft until Save;
  startup/background scanning, scan caches, source changes, and automatic
  scope persistence were not added.
- **A real five-work e-book manuscript passes the suggestion boundary.** Its 44
  Markdown files (33 chapters, 4 supplementary notes, 6 indexes, 1 log;
  390,618 bytes total) now produce 43 editable candidates with the default
  index-page option, or the previous 37 body/supplementary candidates with it
  off. The sample's five local PNG files are individually below the existing
  20 MiB image limit. Source tests and a fresh local App Store preview pin the
  43/37 results; the draft was cancelled without persistence. Semantic use of
  custom `Chapter` / `Note` frontmatter remains held for v2.x; full signed TestFlight PDF/EPUB
  visual proof for this manuscript is not yet claimed.
- **Book Scope now has a whole-book reader in source.** It opens only from an
  explicit Book-view action, renders chapters in saved order through the
  existing sanitized Preview/image boundary, and keeps each chapter's source
  path for relative images and links. Live open-tab buffers win over disk, so
  unsaved edits are visible without being saved or overwritten. Total disk/live
  content is capped at 32 MiB; missing, unreadable, and budget-skipped chapters
  remain visible as notices. Editing a chapter returns through the existing
  workspace tab path rather than creating a second editable buffer.
- **The v2.1 candidate adds bounded search inside the whole-book Reader.** It
  searches only chapter names and visible Markdown already loaded by the
  explicit Reader action, including unsaved live buffers, under the existing
  100-chapter / 32 MiB load boundary. Unicode-normalized, case-insensitive
  results show matching chapters and occurrence counts and jump through the
  existing contents navigation. Hidden leading YAML frontmatter is excluded
  because Reader does not render it. Escape clears a non-empty search before
  closing the Reader. While Reader is open, `Command+F` now focuses this
  bounded Reader search instead of the hidden editor search; Enter advances to
  the next matching chapter (Shift+Enter goes backward, with wraparound). The
  feature creates no persistent index, background scan, source edit, auto-save,
  or new file access path.
- **Interactive Preview image loading is bounded near the viewport.** Workspace,
  explicitly approved outside-local, and enabled remote images stay as inert,
  height-reserved placeholders until they approach the visible area, with at
  most two reads in flight per Preview pane. If nested WKWebView Preview only
  delivers an initial non-intersecting record and no usable intersection, a
  short fallback feeds the remaining placeholders into that same bounded queue
  instead of leaving valid document-relative images permanently blank. A false
  record no longer cancels that fallback. Resolved data URLs are committed back
  to Preview state and no longer retain the transparent placeholder's native
  lazy flag, preventing a later parent render from restoring the blank image.
  Whole-book Reader inherits the same behavior. e-book
  pagination and PDF/EPUB export deliberately keep their existing all-image
  settle path. This changes neither Markdown source nor the local/remote consent
  boundary.
- **Book presentation hides closed leading YAML frontmatter without rewriting
  source.** Whole-book Reader and PDF now use the same bounded strip behavior
  already used by EPUB. Unclosed frontmatter remains visible as source text;
  metadata fields are not interpreted into book semantics.
- **Book Scope PDF/EPUB export and bounded preflight are implemented in source.**
  Existing export dialogs now explicitly choose Current file or Whole book.
  Book output keeps saved chapter order, live dirty buffers, and chapter-local
  image bases. Preflight runs only from the export action, checks unavailable
  chapters, up to 100 workspace images, missing headings, and EPUB metadata,
  and blocks Book export when a chapter is unavailable. It adds no manifest,
  background indexing, source rewrite, or second editable buffer.
- **EPUB Book navigation now uses the saved Book tree.** `nav.xhtml` preserves
  the same document/group hierarchy shown in the Book sidebar instead of
  reparsing `index.md` into a second export-only order; remaining unclaimed
  chapters keep saved Book order as a conservative fallback. Relative and
  bundle-root links between included Markdown chapters are rewritten to their
  packaged XHTML/heading targets, so exported index pages no longer point at
  absent `.md` files.
  Same-chapter anchors also follow headings moved into later XHTML documents by
  explicit page breaks. Single-document EPUB navigation preserves Markdown
  heading levels.
  Apple Books interaction on the heavy manuscript remains a manual TestFlight
  check; source is not changed and no background scan or manifest is added.
- **EPUB export has an optional explicit cover image in v2.3 source.** The
  metadata dialog selects one local PNG/JPEG/GIF/WebP file for the current
  export only. The exporter packages a dedicated `cover-image` manifest item
  and cover XHTML before the content spine. It does not infer the first
  Markdown image, rewrite source, persist a cover choice, crop/edit the image,
  or launch an external cover tool. Apple Books appearance remains a manual
  installed/TestFlight gate.
- **v2.3 source proof was green for the Book UX, image/export, and recent-folder repairs
  before publication.** TypeScript/Vitest (**205 files / 1,721 tests**),
  typecheck, Vite, App Store surface (**10 files / 111 tests**), and the
  helper-enabled App Store preview build passed on tree `2.3.0`; the regression
  covers an initial non-intersecting observer record for
  `/workspace/book/images/cover.png`. Rust proof was **367 pass / 2
  host-dependent ignored**. Build 107 smoke was invalidated (flash-then-blank)
  and held. The repaired built app was checked through Computer Use with the
  real parent workspace, nested `index.md`, and 2.6 MB `images/c00.png`: Preview
  retained the image after 12 seconds and a pane reopen, and e-book page 2
  retained it after 10 seconds. **Mac App Store publication of `2.3.0` was
  user-reported 2026-07-24.** Source tag boundary:
  `docs/releases/2.3.0-source-tag.release.md`.
- **The v2.0 release candidate proof was green.** TypeScript/Vitest
  (**201 files / 1,678 tests**), Vite, Rust (**367 pass / 2 host-dependent
  ignored**), App Store surface (**107 tests**), and the helper-enabled App
  Store preview build all pass on tree `2.0.0`. The built bundle reports
  `2.0.0`, passes deep/strict code-sign verification, and opens an onscreen
  app window. A fresh built app proposed three chapters from the official
  OKF fixture, restored their saved order, and read all three in the whole-book
  reader. Export produced a three-page A4 PDF verified in macOS Preview with one
  chapter per page, plus a valid three-document EPUB whose metadata, spine, and
  navigation preserve Book Scope order. Preflight showed the fixture's missing
  headings and author metadata; a retained unavailable chapter blocked Book PDF
  and EPUB while leaving Current file available.
- **Release-quality export smoke passed on a disposable nested fixture (2026-07-18).**
  The helper-enabled `2.0.0` app rendered Preview with headings, local images,
  and links; saved a five-entry Book tree with `Works → One → Chapters` and
  `Notes` groups; and read all five entries in order with the local images and
  explicit page-break section intact. The exported seven-page A4 PDF was
  rendered page-by-page with no clipping or overlap. The exported EPUB passed
  `epubcheck` with 0 errors and 0 warnings, preserved the saved nested TOC,
  packaged both images, and rewrote the included Markdown links. Opening that
  EPUB in macOS Books showed the nested navigation; clicking `First` and then
  `Second` landed on the packaged `Second Section` target. This is disposable
  fixture evidence only; the heavy manuscript in signed TestFlight remains a
  separate manual proof boundary. `pdftotext` was unavailable on this host, so
  PDF evidence used `pdfinfo` plus Poppler page renders.
- **The v2.0 UX review closed three release-facing gaps.** Books and knowledge
  folders is reachable from the native Help menu as well as Command Palette;
  saving or cancelling chapter selection restores focus to its trigger; About
  and diagnostics derive the visible version from package metadata instead of
  duplicating it.
- **Dependency audits have no release-blocking finding (refreshed 2026-08-16).**
  `npm audit --audit-level=high` reports 0 vulnerabilities. `cargo audit`
  against the refreshed advisory database exits 0 with 18 allowed warnings
  already represented by the existing Tauri Linux / GTK, transitive
  unmaintained-crate, and `pdf-extract` exception set; it reports no high/
  critical vulnerability or new macOS blocker.
- **Structured Markdown / OKF readiness (claim boundary for v2 Alpha):** With
  single-document structure (v1.10), OKF review (v1.11), starter scaffold
  (v1.12), and Book Scope select/order/suggest/read/export + quieted presentation,
  the product can support OKF-style structured Markdown as an **explicit,
  local, non-auto-repair** workflow. In-app Help **Books and knowledge folders**
  documents the loop; store copy is drafted for `2.0.0`. Indexing and auto
  structure detection remain out of scope.
- **Book Scope Alpha built-app interaction smoke passed on 2026-07-18.** A
  throwaway nested workspace covered explicit selection, order changes, dirty
  chapter switching and return, scope-external file opening, relaunch restore,
  external deletion with unavailable retention, in-app rename path tracking,
  and confirmed Trash removal. The follow-up polish localizes lazy-folder
  status and unavailable reasons without changing the scope contract.
- **v1.14 review-candidate Keep themes:** Continuity (same-name tabs, Reference
  retained toggle, recent workspaces, shared right-pane header), Trust (export
  destination/warnings, Assist lock & not-saved, Import draft status), Writing
  Loop (Preview vs e-book, e-book edit-here, Outline hints + heading Undo
  status), Structure/OKF (scaffold pre-create copy, first-fix open guidance).
  That submitted candidate predates Book Scope and contains no indexing,
  auto-repair, or second editable buffer.
- **The v1.14 returning Start Panel is compact in source.** It keeps one short
  write/read/verify pitch, shows the resume target by folder name, moves the
  three basic actions before recents, and lays recent folders out in two short
  columns. Full action wording remains available to assistive technology; the
  panel itself scrolls rather than clipping when recovery items add height.
- **The reproduced v1.14 PDF Reference 150% scroll friction is fixed in
  source.** The PDF stage is the only overflow container. A standard mouse
  wheel pans vertically while room remains, then uses the remaining motion for
  horizontal panning at the edge; Shift+wheel pans horizontally. Trackpad
  two-axis input remains native. Real-mouse packaged interaction is still a
  hands-on smoke item.
- **Theme G media (shipped in `1.13.0`, evidence ongoing):** M0–M4 remain Keep
  in source. Signed TestFlight export recheck and pin-to-assets Undo breadth
  remain device evidence, not a reason to reopen `1.13.0`. Manual smoke:
  `docs/smoke-checklist.md` § Theme G.
- **Book Scope UX quieting is in source.** After scope is saved, the Book view
  leads with whole-book read + edit (settled list presentation). Workspace
  suggestion stays a setup action (empty state and chapter edit). Recheck is
  progressive when entries are unavailable. Chapter rows hide root-level path
  noise. Export dialogs say “本全体 / Whole book” instead of internal Book Scope
  jargon; OKF review opens with one short purpose line and shows the
  disk-snapshot note only after a scan. Further density polish (compact
  icon toolbar / More menu for recipe + recheck) may land as post-ship residual
  on main and is not part of the published `2.3.0` claim.
- **v2 Help expansion is in source.** The native Help menu and Command Palette
  open **Books and knowledge folders…** (English Help body). Local Data
  Disclosure mentions whole-book export and app-private book order. About /
  diagnostics derive the current `2.6.2` package version from package metadata.
- **Open main queue:** U-1 conversational proofread on Apple Intelligence, then
  U-3 / U-4 and G-1. H-1 System model reuse is complete in M-0a. C-1 HOLD until
  a production `.aimodel` identity.
  Mac App Store `2.6.2` is published (user-confirmed 2026-08-28; staged
  rollout). v2.5 is released and closed; published `2.6.2` remains closed
  without a reproduced hotfix; other advisory items stay parked.
- **Parked / on-demand:** residual polish; broad TestFlight / VoiceOver /
  evidence matrix; bulk external-review backlog digestion.
- **`1.8.0` build `89` remains a closed historical Mac App Store baseline**
  (published 2026-07-14) superseded by `1.12.0`. Extended TestFlight interaction
  breadth and spoken VoiceOver remain ongoing quality evidence rather than
  reasons to reopen published tags.
- **The v1.8 PDF-reference zoom adjustment is included in published
  build `89`.** The duplicate-looking fit-page control was removed;
  PDF reference display now offers fit width plus a raster-independent 150%
  view. The zoomed page is a native two-axis scroll region and supports Arrow
  key / Page Up / Page Down panning without changing pages. Package/app
  signatures and publication provenance passed; hands-on panning with a real
  PDF is user-side follow-up evidence.
- **The v1.8 structured-Markdown preparation is included in published
  build `89`.** Outline, e-book chapter splitting, and EPUB export now share one
  leading YAML frontmatter boundary. Heading-like metadata is no longer shown
  as an Outline heading; CRLF and unclosed-frontmatter behavior is pinned by
  tests. This is interpretation-only hardening: it adds no hidden document
  model, structure UI, or source rewrite.
- **v1.9 Writing Loop Clarity W1–W4 are source complete and reviewed.** The
  review fixed stale Command Palette labels when locale changes while the
  palette is open, aligned the returning Start Panel kana CTA, and repaired
  release/lane document checks. v1.9 stayed source-complete without its own
  public release and is present inside the `1.11.0` candidate.
- **v1.10 Single-document Structure Foundation S1–S4 is source complete and
  has representative packaged interaction proof.** `parseMarkdownStructure` provides
  one source-offset interpretation of closed leading frontmatter, ATX headings,
  standalone page-breaks, and EPUB navigation candidates. Existing Outline
  now shows heading hierarchy and page-breaks, exposes non-blocking structure
  suggestions, and allows only an explicit one-level ATX heading change through
  one Undo-able CodeMirror transaction. No manifest, second buffer, background
  scan, automatic correction, section move, or Book Scope was added. Generate
  deterministic smoke documents with `npm run smoke:fixtures:v1.10-structure`.
  On 2026-07-14, a fresh local bundle opened the temporary fixture workspace
  and exposed the expected hierarchy/page-break rows, three overview advice
  kinds, and the 803-line section advice. A one-level H3→H2 edit set dirty and
  one `Cmd+Z` restored the original source and clean state. Source-jump breadth,
  IME, Save As, recovery, e-book/EPUB, and signed TestFlight remain manual proof
  and move into the v1.11 distribution-confidence matrix rather than reopening
  v1.10.
- **v1.12 OKF Starter Scaffold is closed and published as `1.12.0`.** Explicit
  Command Palette / folder-context actions create a new uniquely named folder
  with fixed minimal or book-like Markdown templates (living pin now OKF v0.2
  `3fcbb9f…`), open `index.md`, and invite a separate explicit review. No Book
  Scope, auto-repair, or multi-file export. Contract:
  `docs/v1.12-okf-scaffold-design.md`. Release notes:
  `docs/releases/1.12.0-app-store-release-notes.md`. Source tag: `v1.12.0`.
  The source-hardened path materializes the actual local creation date, rejects
  unclean relative paths / NUL content, creates nested directories without
  following an existing tree, and cleans up only artifacts it created. Tree
  refresh or `index.md` open failures remain visible instead of being replaced
  by a success status. The sidebar New menu exposes expanded state and standard
  arrow/Home/End/Escape keyboard movement. Local candidate gates and App Review
  passed; publication was user-reported 2026-07-17.
- **v1.11 OKF Draft Compatibility Preview is locally candidate-ready.**
  Fixtures, a `yaml`-backed pure model, async cancellable Rust discovery, and
  the OKF review surface (Command Palette + folder context menu + read-only
  panel) are in tree. The writer-facing action loop is also in tree: command/title
  `知識フォルダ（OKF）を点検`, purpose intro, ordinary-manuscript vs
  knowledge-folder status framing, separate required / OKF preparation /
  improvement / reference groups, and disclosure for files, reference facts,
  spec, and raw counts. `開いて修正` opens the existing editor tab, best-effort
  jumps to a finding line when an offset is available, and moves the modal out
  of the editing path with a recheck status hint; `変更後に再点検` (or
  re-invoking the review) performs the next explicit disk scan. Full analysis
  still runs only on explicit invoke—not on workspace open. Discovery revalidates opened-file identity, analysis and
  rendered findings have explicit caps, findings follow the active locale, and
  a workspace change closes/cancels the owning review. On 2026-07-15, the
  packaged Command Palette and folder-context flows passed review → open/edit →
  save → recheck; the fresh scan reduced required findings after the saved
  fixture correction. Full frontend/Rust/App Store surface gates, local sandbox
  entitlements, universal submit-app signing, helper inheritance, pkg signing,
  metadata, and checksum verification also passed. This is local candidate
  evidence, not TestFlight installation or interaction proof. The contract remains
  an explicit, bounded, cancellable, read-only
  review of one user-selected workspace root or subfolder against OKF v0.2,
  with best-effort v0.1 reads. It does not add startup scan, persistent
  indexing, automatic repair, chapter ordering, multi-file edit, whole-book
  export, or Book Scope. Contract:
  `docs/v1.11-okf-draft-preview-design.md`.
- **v1.6 (`1.6.0`) is closed and published.** Mac App Store App Review passed
  without issues (user-reported 2026-07-10). Release note:
  `docs/releases/1.6.0-app-store-release-notes.md`. Product scope: Import
  Assist Phase 1 (PDF / image → unsaved Markdown draft, on-device PDFKit +
  Vision), 江戸彼岸 theme, CodeMirror `@codemirror/view` **6.43.2** pin, PDF /
  image path trust polish, and the `pdf-extract` security update. Boundary:
  `docs/archive/reviews/import-assist-boundary-review-v1.6.md`. Quality notes
  (historical for this lane): `docs/archive/operations/quality-inventory-v1.6.md`.
- **v1.7 (`1.7.0`) is closed and published.** App Review passed and the Mac
  App Store release was published (user-reported 2026-07-12). Reference Compare
  keeps one editable Markdown buffer beside one read-only reference. Release
  note: `docs/releases/1.7.0-app-store-release-notes.md`.
- **v1.8 (`1.8.0`) is closed and published.** App Review passed and the Mac
  App Store release was published (user-reported 2026-07-14) as build `89`.
  It hardens the v1.7 Reference Compare plus trust / daily-use experience:
  L Mode continuity with a hidden Reference session, bounded long-reference
  rendering, deterministic Rust suite isolation, keyboard / VoiceOver
  semantics, kana UI copy, export preflight, theme cost, and failure-state
  messaging. Release note:
  `docs/releases/1.8.0-app-store-release-notes.md`. Do not reopen without a
  reproduced hotfix.
- **v1.8 implementation evidence (shipped in `1.8.0`).**
  Editable Markdown stays center/primary; one read-only PDF / image / Markdown /
  text reference opens on the **right as a preview-like pane** (not Diff, not a
  second edit tab), including automatic source pairing after Import Assist.
  Design: `docs/archive/planning/v1.7-reference-compare-design.md`. Scope brief:
  `docs/archive/planning/v1.7-scope-brief.md`. **R0–R4** are in source. **T-1 / T-2 / S-2 root
  recovery / S-3 wrap-safe long-reference rendering+rename a11y / S-4 Start Panel** source landed
  2026-07-11. Recovery cleanup failures are now surfaced across Save / Save As /
  restore / discard / close, and text references have a separate 1.5M-character /
  50,000-line DOM budget. T-1 now also keeps a loaded Reference session while
  hiding its pane in L Mode, then restores the pane on return. A separate-ID
  Developer bundle passed Reference hide/restore and post-remount Undo on
  2026-07-12. S-3 now has a deterministic fixture generator; a separate-ID
  Developer bundle passed 5,000-line Japanese wrap/scroll/selection and both
  1.5M-character / 50,000-line rejection paths while preserving the editor and
  existing reference. Long-reference copy was verified by copying the full
  reference and pasting it into a disposable editor buffer, then confirming the
  `END-MARKER-5000` tail; clipboard contents were not read directly. Signed
  TestFlight interaction and full a11y smoke remain v1.8 follow-up evidence
  rather than v1.7 publication blockers.
  T-2's pathless `Discard All` cleanup-failure path is now pinned by a focused
  regression: the user-visible warning is emitted and the close still
  continues. Signed TestFlight coverage and stale-candidate cleanup remain
  manual follow-up evidence.
  S-2 was rechecked on current HEAD with three serial full Rust-suite runs;
  each passed 338 tests with the two explicit host-integration cases ignored.
  Quick Open, Command Palette, and Global Search now expose dialog,
  combobox/listbox, active-option, and search-status semantics for keyboard and
  VoiceOver navigation. Global Search also localizes missing-workspace and
  runtime failure status while preserving the underlying diagnostic, without
  showing the zero-match state for a failed search. Command Palette and Global
  Search dialog/combobox names, placeholders, and empty states now follow
  English / Japanese / kana; the latest Developer bundle exposed the expected
  Japanese and kana names in the macOS accessibility tree. Inline file/folder
  rename inputs use the active English / Japanese / kana label rather than an
  English-only accessible name; packaged VoiceOver smoke remains required. The
  Reference Compare empty-editor hint now carries an explicit polite live-region
  contract, with a focused AppWorkspace regression. Its narrow-pane Draft /
  Reference toggle buttons now expose `aria-pressed` and a localized toolbar
  name, with a focused regression that pins the selected target for assistive
  technology; locale coverage pins the same toolbar key set and the English /
  Japanese / kana labels. The contextual Slash command listbox now also exposes
  a localized accessible name, with copy-key parity coverage. Tab row and tab
  list containers also use localized names for the active menu language.
  The primary Editor pane label now follows the same locale contract, with
  focused EditorMainPane and Safe Editor copy coverage.
  Workspace file rows now localize the open / unsaved state announced to
  assistive technology, with WorkspaceTree and file-ops locale coverage.
  WorkspaceTree loading and per-folder truncation notices now use the same
  localized file-operations copy. Text and image tab close controls now also
  use active English / Japanese / kana copy, with AppTopChrome and Safe Editor
  locale regressions. Dirty tab descriptions now use the same localized
  unsaved-state copy instead of an English-only hidden label.
  The Local Assist generation-lock status now follows the active English /
  Japanese / kana copy as well, while retaining its polite live-region and
  read-only editing boundary.
  The Editor full-path copy button now also uses a kana accessible name
  instead of falling back to the English label.
  Reference PDF loading now exposes a localized status message instead of an
  ellipsis-only live status.
  Reference Text/Image panes now keep a kana read-only role label instead of
  falling back to English.
  PDF stale-handle errors now keep kana copy as well, while unknown diagnostic
  details remain unchanged.
  The PDF 150% zoom control also keeps a kana accessible name instead of
  falling back to Japanese kanji.
  Editor内検索のkana「前へ」操作も誤記を修正し、検索バーの表示名と
  VoiceOver名を`まえへ`に揃えた。
  L Modeのkana Typewriter説明に残っていた文字化けも修正し、カーソル行を
  縦方向中央付近へ保つ説明を自然なかな表記へ揃えた。
  Side PaneのPreview無効理由もkanaで表示し、漢字の`無効`へ戻らないようにした。
  Preferencesのkanaテーマ説明に残っていた`じょうけ ん て ま す`の分割崩れも
  修正し、テーマの説明文を自然なかな表記へ揃えた。
  Auto-backupのkana説明に残っていた`未保存`もかな化した。
  The App Store surface smoke also passed on 2026-07-13 (**10 files / 99
  tests**), covering pane controls, Command Palette, settings, review-state,
  and distribution-lane contracts.
  The installed public `1.7.0` build `85` also passed `⌘⇧P` Command Palette,
  `⌘⇧F` Global Search, and native 表示-menu traversal on 2026-07-13; this is
  keyboard/menu evidence, not spoken VoiceOver or signed TestFlight evidence.
  The latest local App Store preview bundle also passed `smoke:macos-window`
  with a 1282x822 onscreen window, and its macOS accessibility tree exposed
  the Japanese tab row/list, tab close names, pane controls, workspace tree,
  and Editor region. This is packaged AX-tree evidence only, not spoken
  VoiceOver or signed TestFlight evidence.
  A local Poppler render review of the existing nine-page PDF inspected pages
  1–3 with no clipping and white edge samples on all four corners. Poppler
  reported a local `Adobe-Japan1` language-pack limitation, so the disposable
  Japanese fixture was exported separately and opened in macOS Preview on
  2026-07-13: Japanese glyphs were visible within the A4 margins and Preview's
  accessibility tree exposed the same Japanese text. This closes the local
  Developer visual check; signed TestFlight export breadth remains open.
  The latest source-built App Store sandbox preview passed deep-signature,
  app-sandbox, user-selected read/write, app-scoped bookmark, and inherited
  helper entitlement checks on 2026-07-12. That App Store preview pass did not
  claim picker interaction; separate-ID Developer picker evidence is recorded
  in `docs/smoke-checklist.md`.
  No per-character confidence claims.
  A current-HEAD recheck of `SKIP_BUILD=1 npm run smoke:macos-sandbox-preview`
  passed on 2026-07-13 with valid app/helper signatures, app sandbox,
  user-selected read/write, app-scoped bookmark, and sandbox + inherit
  entitlements on both helpers.
  The top chrome now separates L Mode from right-pane selection and exposes an
  explicit `参照` item beside Preview / e-book / Outline / Diff. Switching pane
  content retains the loaded reference; the in-pane close action remains the
  explicit end of the reference session.
  A rebuilt separate-ID Developer bundle opened the disposable
  `/private/tmp/hazakura-valid-text.pdf` as a read-only right-side page image and
  workspace `reference-image.png` as a read-only image on 2026-07-13 while the
  center `EDITOR-BUFFER-MARKER` remained unchanged. This extends local PDF /
  image Reference evidence; additional matrix cases and signed TestFlight
  interaction remain open. A second Developer pass closed and reopened the
  image, replaced it with a nine-page PDF, moved to page 2, and exercised
  fit-page plus 150% controls. The Reference column was also narrowed to 25%
  and kept the image contained while the center marker stayed intact.
  `ReferenceTextPane` also now directly asserts the
  image alt name, data URL, read-only copy, and absence of an editable text
  surface. `ReferencePdfPane` now also asserts a file-and-page accessible name
  for rendered PDF rasters, alongside the image-reference alt/read-only test.
  Its focused suite also pins that a stale raster cannot replace the current
  page after the Reference ID changes.
  `AppWorkspace` also pins that closing or replacing the visible reference
  leaves the center editor buffer and its change callback untouched.
  A separate-ID Developer pass temporarily moved the referenced image out of
  the fixture, surfaced `The reference file has changed on disk.` with an
  explicit Reload action, and restored the image after the fixture path was
  returned.
- **v1.8 S-1 bounded failure UX is source + packaged smoke verified.** Global Search
  preserves diagnostic details while suppressing the false zero-match state;
  workspace search caps per-file matches, total matches, visited files, and
  line preview length with explicit truncation; Diff and PDF raster paths keep
  bounded failure messages and retry/stop behavior. Focused source checks pass;
  A fresh isolated Developer bundle with no workspace showed the Global Search
  combobox and `Open a workspace to search its files` without a false zero-match
  message. Replacing that disposable workspace path with a regular file then
  surfaced `Selected workspace path is not a folder.` without a false zero-match
  result; the original fixture was restored afterward.
- **v1.8 P2 theme budget hardening is source + Developer smoke verified.** The
  resident Edohigan WebGL overlay now uses the shared intensity-aware DPR cap
  and frame throttle already used by CRT/Shinkai, so it no longer bypasses the
  ambient render budget. Focused theme tests, full source gates, and Developer
  theme switching (CRT / Edohigan / Shinkai) kept the editor and Preview
  content intact after boot animations. Signed TestFlight visual/accessibility
  breadth and a measured device FPS baseline remain open.
- **v1.8 S-4 purpose-led discovery is source + Developer smoke verified.** The
  existing Start Panel keeps its write / read / verify pitch, and the five
  right-pane controls now explain their task in English / Japanese / kana
  tooltips instead of repeating only the feature name. Focused locale checks
  passed (**2/2**); the latest separate-ID Developer AX tree exposed those
  localized Help strings. Signed TestFlight breadth and spoken VoiceOver
  remain follow-up evidence.
- **v1.8 P2 export preflight and Developer output proof are complete locally.** EPUB
  and PDF settings now state whether current unsaved changes are included,
  explain that unavailable workspace images are reported as warnings, and say
  that the concrete `.epub` / `.pdf` destination is selected in the next Save
  dialog. PDF export no longer overwrites an image-warning success status with
  a generic success message. A separate-ID Developer bundle exported unsaved
  content to both formats without changing the source file: the EPUB archive
  retained Japanese metadata, spine order, and the unavailable-image warning;
  the PDF rendered as nine A4 pages. That inspection exposed a transparent
  trailing-page background, now fixed by an explicit white export layer and
  covered by regression assertions. Signed TestFlight breadth remains open;
  the local Developer Japanese glyph check is recorded above.
- **v1.5 (`1.5.0`) is closed and was released before 江戸彼岸 (edohigan).**
  v1.5 covered Spellcheck settings, Reading Focus TOC density, CRT/Shinkai
  lineage polish, dead-code, deps hygiene, traffic-light, L Mode remount.
- The Pure-Rust PDF text fallback uses `pdf-extract` **0.12.0** and
  `lopdf` **0.42.0**, replacing the vulnerable `lopdf` 0.34 dependency reported
  by `RUSTSEC-2026-0187`. The PDFKit-first import behavior and all Safe Editor
  boundaries are unchanged.
- PDF image paths use the same document-relative and workspace-contained
  policy in Preview, HTML export, and PDF export. Open the project parent that
  owns both manuscript and images; child-workspace `../assets` references are
  blocked with an explicit parent-workspace hint. Optional packaged App Store
  re-smoke of the parent/child/drag-drop/missing matrix remains useful
  regression breadth, not a v1.6 reopen trigger.
- Historical Mac App Store baselines (`1.3.0` Daily Trust and earlier) remain
  part of product history. Treat listing/build counters in Connect as
  authoritative for store facts; this file tracks product-lane truth for
  agents.
- v1.3 Daily Trust remains an approved historical baseline. Four bounded
  slices ship in `1.3.0`: Save As keeps the same-language open-tab /
  CodeMirror session and migrates per-document view state; Local Assist
  review uses explicit `採用` / `破棄` without auto-save; Reading Focus TOC
  shows bounded H3+ context plus current measured page progress; and direct
  PDF export offers request-scoped A4 `狭い` / `標準` / `広い` margin
  presets. Extended RC interaction breadth remains in
  `docs/archive/operations/v1.3-followup.md`.
- `1.0.0` was approved and released on the Mac App Store. It is a
  semantic and product-message re-baseline of the feature shape first
  shipped through `0.36.0`, not a new feature expansion. Its public message is:
  `Markdownで書き、本として読み、ローカルAIで整える。`
- The signed App Store / TestFlight `1.1.0` candidate containing the
  completed position-continuity slice passed source, build, audit, signature,
  entitlement, checksum,
  distribution-probe, and sandbox-preview gates. Its local provenance
  is in `docs/internal/app-store-candidates/latest.json`; the public
  listing later confirmed `1.1.0`, while raw App Store Connect,
  TestFlight, and App Review logs are not tracked in this repository.
- A 2026-06-28 user-side pre-v1 pass accepted the Golden Manuscript flow,
  long-form e-book page-turning, EPUB page breaks in Apple Books, Local
  Assist success / failure / apply / discard, and the App Store safety
  boundary. No v1 No-Go condition was reported. Unchecked boxes are not
  treated as automatic blockers; commented observations are classified
  in `docs/archive/operations/v1.1-v1.2-followup.md`.
- No remaining source-level release blocker is known for the closed v1.6,
  v1.7, or v1.8 lines. Do not reopen them without a reproduced gap. The
  v1.9 Writing Loop Clarity and v1.10 Single-document Structure Foundation are
  implementation complete. **v1.12 OKF Starter Scaffold** is locally
  candidate-ready; v1.11 OKF Draft Compatibility Preview is held inside that
  candidate. Shared OKF pin: `docs/okf-spec-pin.md`.
  `AppWorkspace` owns a shared
  per-document view-state registry: reader, Editor cursor/scroll, Preview
  reopen, tab transitions, and safe local Markdown-link transitions now
  preserve the relevant document position. Earlier path-backed workspace
  Recovery forced-termination smoke passed. On 2026-07-12, a disposable
  separate-bundle Developer app also restored a force-terminated pathless T-2
  draft into a new unsaved tab with its marker intact. This is local packaged
  interaction evidence, not signed TestFlight proof. Google Drive remains
  `manual-blocked` because no dedicated fixture existed and user cloud content
  was not touched.
- Mac App Store listing: `Hazakura Editor`
  (`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`).
- Current development-tree version: **`2.8.0`** (signed local package prepared;
  upload, approval and publication pending). A-1–A-4 source work is merged
  plus theme/Preview polish and the right-pane ownership fix;
  the pinned target, bounded multi-turn revision, and explicit Diff apply remain
  on the same Local Assist surface. The editor remains unchanged until that
  explicit action and is never auto-saved.
  Local package provenance is in `docs/internal/app-store-candidates/latest.json`.
  Frozen v2.7 App Store What's New:
  `docs/releases/2.7.0-app-store-release-notes.md`.
- Published Mac App Store version: **`2.6.2`** (user-confirmed 2026-08-28;
  staged rollout to all users). Prior store baselines (`2.4.0`, `2.3.0`,
  `2.0.0`, `1.13.0`, …) remain historical.
- Latest published GitHub source / local-app tag: `v3.0.0` (source archive only;
  see `docs/releases/3.0.0-source-tag.release.md`). Prior checkpoints: `v2.3.0`
  (`docs/releases/2.3.0-source-tag.release.md`) and `v2.0.0`.
- Latest local App Store / TestFlight package candidate metadata
  (version, build counter, pkg path, SHA-256, generated time, source
  commit, smoke status) lives in
  `docs/internal/app-store-candidates/latest.json`, regenerated by
  `npm run release:candidate -- --with-app-store-pkg`. Tracked docs no
  longer carry per-build SHA / pkg path values; consult `latest.json`
  for the active artifact. Raw App Store Connect, TestFlight, and App
  Review logs are not tracked in this repository unless separately
  recorded. The public listing state is recorded separately from local
  package evidence.
- Source-level `v0.36` e-book page-turn stabilization is implemented
  locally. The reader now treats only H1 / H2 headings as chapter
  boundaries, keeps H3+ headings inside the current chapter, prevents
  keyboard auto-repeat from outrunning page state, guards pending
  chapter-cross turns while the next chapter renders, and prevents
  same-chapter image remeasurement from shrinking the committed page
  count. EPUB export now splits explicit page-break markers into
  separate XHTML content documents and keeps OPF spine / navigation
  links aligned with those split documents. Source proof exists through
  focused reader / chapter / EPUB tests and release preparation.
  `0.36.0` is now publicly available on the Mac App Store; detailed
  Golden Manuscript smoke, long illustrated manuscript page-turn proof,
  and actual EPUB-reader page-break confirmation remain useful product
  evidence rather than prerequisites for describing the release as
  published.
- Source-level `v0.35` PDF export recovery is implemented locally. The v0.34
  native print path is superseded because TestFlight still showed
  macOS' "This application does not support printing" alert after a
  local manual print smoke had passed. v0.35 moves the user-facing action
  to direct PDF export: the user chooses a `.pdf` destination, Rust keeps
  the main-window / non-empty HTML / `.pdf` destination guards, an
  app-owned WebView renders the HTML, WebKit creates PDF data, and Rust
  writes that data to the selected file. The user-facing path no longer
  depends on a browser, shell, external opener, or macOS print dialog.
  The legacy `print_html` command registration and frontend wrapper are
  removed, and `export_pdf` waits off the command event path so WebView
  load / PDF callbacks can complete.
- Source-level `v0.33` EPUB Export v1 Polish is implemented. EPUB export
  remains an explicit active-document action over Markdown source, but
  user-facing copy now presents it as `EPUB書き出し` / `EPUB Export`
  instead of beta copy. The archive builder keeps the compatible
  `buildEpubBetaArchive()` wrapper and adds
  `buildEpubBetaArchiveWithReport()` so callers can distinguish a
  successful archive from non-fatal image replacement warnings. The first
  report type is `image-unavailable`; successful exports with replaced
  images now report a warning status rather than a silent success. EPUB
  nav/content XHTML now uses the selected language metadata instead of
  hardcoding `ja`. No Book Workspace, cover editor, advanced metadata,
  navigation editor, in-app EPUBCheck, external validator launch, or
  second EPUB document model was added. A 2026-06-25 proof-close pass
  generated an external fixture EPUB from Japanese Markdown with a local
  image, external-image warning, links, code, table, task list, and
  page-break hint; archive inspection confirmed nav/content XHTML,
  packaged local image, `image-unavailable` warning output, `ja`
  XHTML language metadata, and unchanged source hash. External
  `epubcheck` completed with 0 fatal errors / 0 errors / 0 warnings.
  The `0.33.0` App Store / TestFlight package candidate is now generated
  as build `41`; upload, Apple processing, TestFlight install / launch,
  and App Review remain outside this repository state. Source/local proof
  passed with focused EPUB / export hook / status tests, full
  `npm run test`, `npm run build:vite`, `npm run build`, App Store
  surface smoke, local distribution probe, package signature check,
  sandbox preview smoke, and `git diff --check`. At that checkpoint,
  built-app manual EPUB smoke was blocked because LaunchServices failed
  with `kLSNoExecutableErr` even though bundle inspection passed. A later
  2026-06-30 v1.2 `smoke:macos-window` run successfully launched an
  onscreen Developer bundle window; manual EPUB interaction smoke has not
  been rerun.
- Source-level v1 workspace / slash-command fit-and-finish is
  implemented. The workspace tree now shows existing-tab-derived open
  and dirty markers for files inside the selected workspace, reusing
  `isDirty()` so unsaved content, line-ending, and encoding changes align
  with the tab bar. Pathless untitled tabs, workspace-external tabs,
  directories, and image-only preview state do not create workspace
  markers. The editor content area now opens the existing slash-command
  menu from right-click; it preserves selection when invoked inside the
  selection, otherwise moves the cursor to the clicked editor position.
  This surfaces the existing allowlisted Markdown wrappers and insert
  helpers without adding a formatting toolbar, Git status, background
  indexing, new Agent / Review commands, arbitrary command execution, or
  a broader workspace model. Verification passed with focused workspace
  / editor slash tests, full `npm run test`, `npm run build:vite` (with
  the usual Vite chunk-size warning), and `git diff --check`. Built-app
  visual smoke remains blocked by the same local preview launch failure
  described above, not passed.
- Source-level `v0.32` Editor / Reader Position Bridge work is in
  progress after the user reported light `0.31` testing as problem-free.
  The current implementation records e-book chapter start lines, opens
  e-book Mode near the current editor / visible scroll position, keeps
  stale stored reader pages from overriding the next entry point, and
  returns from Reading Focus through an optional approximate `sourceLine`
  before falling back to the chapter heading. The e-book reader now also
  resets location by document key rather than only by path, so pathless
  unsaved tabs do not inherit another untitled tab's reader position;
  `AppWorkspace` regression coverage now pins this tab-id separation
  through the parent reader-location state. Same-document reader
  location updates are now also synced back into mounted `EBookPane`
  instances, so the right-pane one-page reader and Reading Focus spread
  reader stay on the same chapter/page state instead of drifting apart.
  Right-pane one-page reader navigation now also drives the editor to the
  reader's approximate source line, so read, notice, and edit can happen
  without entering Reading Focus first; passive source edits and chapter
  reclassification do not push the editor position back from the reader.
  Active in-file `Command+F` results now travel in the opposite direction as
  well: the right-pane reader and Reading Focus move to the result's chapter
  and estimated page. In spread view the target is aligned to the left page of
  the containing spread so next/previous paging remains on the two-page grid.
  Local build and window-launch smoke passed for the generated preview
  app; built-app interaction checks for normal, unsaved, and recovered
  documents remain pending. A release-hygiene follow-up removed a
  machine-local review-note path from the current docs; current
  added-line greps for local paths, development-note markers, and
  credential-like strings are empty.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- `v0.18.0` is a Developer / GitHub lane preview, ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- The helper-free App Store lane delivered `0.18.0` build `4` to
  TestFlight on 2026-06-12 with no reported Apple validation warnings;
  basic TestFlight launch / save smoke passed.
- The `0.19.0` App Store lane passed App Review and was published on
  2026-06-18, based on the user-provided public listing above. The
  tracked submit-lane candidate for that approval was build counter
  `14`; local package and signing evidence remain historical release
  evidence, not the next active queue.
- The helper-free App Store update for `0.25.0` has been reported as
  released on 2026-06-20. Local package evidence for historical builds
  (0.25.0 build `18`, 0.26.0 build `21`, 0.27.0 build `22`, 0.28.0
  build `26`) is archived in `docs/app-store-build.md` and
  `docs/releases/`; per-build pkg path / SHA-256 values are no longer
  carried here. Raw App Store Connect, TestFlight, and App Review logs
  are not tracked in this repository.
- The helper-free App Store update for `0.26.0` has been reported as
  released on 2026-06-20 after App Review completion, following the
  Japanese `電子書籍` label correction. See `docs/app-store-build.md`
  and `docs/releases/` for historical package evidence. Raw App Store
  Connect, TestFlight, and App Review logs are not tracked in this
  repository.
- The helper-free App Store package candidate for `0.27.0` (build `22`,
  after the `v0.27.0` source / local-app tag) and for `0.28.0` (build
  `26`, after the v0.28 safety / quality / AI review foundation slice
  and top-chrome quieting pass) passed local signature, entitlement,
  helper-absence, bundled-notice, supported-OS, and package SHA checks.
  Per-build pkg path / SHA-256 values are archived in
  `docs/app-store-build.md` and `docs/releases/`. App Store Connect
  upload, processing, TestFlight, App Review, and release handling are
  not tracked in this repository unless separately recorded.
- Pre-approval human-side App Store lane smoke on 2026-06-12 passed launch,
  basic document creation/open, preview/export, image paste/drag-drop,
  App Store surface omission, dirty-close confirmation, Move to Trash,
  and network observation. Save As UX remains an observation, workspace
  restore is acceptable with a residual Google Drive /
  quit-before-interaction risk, and live accessibility was partial at
  that checkpoint. A `Cmd+Shift+F` global-search result activation bug
  found during smoke has a focused code-level fix.
- Older public tags and release assets remain immutable.
- The `0.29.1` helper-enabled App Store update has been reported as
  approved and released on 2026-06-23. It carries the v0.29 AI assist
  review API alignment plus the v0.29.01 Hazakura Local Assist
  responsiveness hardening. The v0.28 Safety, Quality, and AI Review
  Foundation lane is implemented / accepted locally, and the v0.29 shape
  retires the standalone Review Desk screen while preserving the internal
  candidate comparison primitive for AI assist plumbing. A 2026-06-21
  static review of the Hazakura Local Assist App Store lane is triaged in
  `docs/current-work.md`. Source-level fixes cover the
  `apple-assist.html` App Store Vite entrypoint, safe default `none`
  assist surface, command-palette/menu active-setting gate, no startup
  main-shell availability probe, `Hazakura Local Assist` visible naming,
  softer Local Assist network wording, short probe timeout separation,
  and helper error hygiene that avoids Foundation Models
  `debugDescription` in user-facing error envelopes. `0.29.1` also adds
  request-scoped streaming preview, target-editor generation lock,
  shorter user prompts, clearer Local Assist availability settings, and
  reduced Markdown preview flicker during editing. Build `33` supersedes
  builds `31` and `32` as the local package evidence used for the final
  review cycle. Build `30` is superseded by `0.29.1`; build `29`
  delivery succeeded earlier on 2026-06-22, but it used the previous
  Apple-branded helper executable name. A 2026-06-21 user-side light
  built-app smoke confirmed the dedicated Local Assist UI opens, the
  helper is absent from Activity Monitor memory before opening the Local
  Assist window, and a simple request can be generated/applied and
  checked through the diff/update flow. Local pre-review regression,
  package, payload, dependency-audit, bundle metadata, license-resource,
  and bundle-size evidence remains archived under
  `docs/archive/operations/` or summarized in `docs/current-work.md`; it
  should no longer drive the main queue unless older App Store evidence
  is explicitly needed.
- The current Hazakura Local Assist source surface separates visible
  preset labels from internal action IDs. Pressing a preset inserts its
  concrete request sentence into the editable request field, and the live
  helper receives a fixed base instruction plus separated action, visible
  request text, target text, and surrounding context. The visible helper
  presets are intentionally trimmed to the compact set (proofread,
  summarize, translate, next ideas, shorten), while hidden action IDs can
  still support free-form fallback and older payloads. Candidate text is
  sanitized before application if a live model echoes Hazakura prompt
  boundary markers. All presets follow the same explicit, unsaved,
  diff-reviewable AI edit transaction flow.
- The `v0.29.01` Hazakura Local Assist responsiveness lane is implemented
  and packaged as `0.29.1`: heavy Foundation Models generation is
  separated from UI responsiveness, the active target editor is locked
  while generation is in flight, app-known progress and streaming preview
  appear in the Assist Window, and only the final result enters the
  existing unsaved AI edit transaction / Diff review path.
- The latest generated helper-enabled App Store package evidence for
  `0.29.1` is build `33`, generated on 2026-06-22 after Local Assist
  streaming responsiveness, prompt simplification, review-facing settings
  polish, and the Markdown preview flicker fix.
  Local App Store surface smoke, live helper build smoke, signed app
  probe, package signature, package metadata, helper-name, helper
  entitlement, `productbuild --synthesize`, and sandbox preview checks
  passed. Per-build pkg path / SHA-256 values are archived in
  `docs/app-store-build.md` and `docs/releases/`; they are no longer
  carried here. Earlier build `29` was reported as delivered through Transporter on
  2026-06-22 after the helper sandbox entitlement fix; build `30`
  superseded it for the helper-name change, build `31` superseded build
  `30` for the `0.29.1` Local Assist responsiveness candidate, and build
  `33` superseded build `31` after the preview flicker fix. The user
  reported App Review approval and public release on 2026-06-23. Raw App
  Store Connect, TestFlight, and App Review logs are not tracked in this
  repository unless separately recorded.
- The published `0.32.0` App Store lane includes Hazakura Local Assist as
  a narrow preview on-device writing companion. Agent Workbench, CLI
  Agent launch, arbitrary command execution, external AI/API calls,
  provider-add UI, and network fallback remain outside the App Store lane.
- The v0.20 Sakura workspace ergonomics slice is implemented locally:
  the main chrome can collapse / restore the workspace sidebar, the
  central editor pane keeps a thin bottom full-path copy bar for the
  active file, Markdown preview hierarchy is more card-like, and the
  selected workspace file has Sakura-specific accenting. The tab-row
  new-file `+` affordance was removed after visual review; New File
  remains available through existing menu, shortcut, and workspace-file
  actions. Workspace switching dropdowns remain deferred to preserve the
  simple single-workspace model.
- The v0.25 native-feeling Safe Editor chrome polish Phase 1 code/CSS pass
  is implemented: traffic-light-safe drag / no-drag rules, subtle editor
  focus visibility, truthful mode active state, e-book chrome token cleanup,
  segmented right-pane mode controls, and tokenized Diff row backgrounds.
  Human-side spot check found no blocker; keep targeted manual smoke as
  the final proof for actual macOS titlebar dragging and click hit-testing.
  The CSS-only glass follow-up was dropped (scrap-and-build); v0.25 now
  moves into native vibrancy via `window-vibrancy` with the macOS
  deployment target raised to macOS 26. See
  `docs/archive/planning/native-macos-appearance-plan.md`.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal,
  arbitrary command execution, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted
  `codex`, `opencode`, `pi`, or `claude` provider session in the
  selected workspace after restart-required enablement and
  responsibility-boundary consent.
- The standalone Review Desk screen is retired from the current
  App Store-safe surface. Diff, recovery review, and Hazakura Local Assist
  transaction review remain explicit; the internal candidate comparison
  primitive still must not auto-save, auto-apply, launch helpers, or call
  external AI/API by itself.
- Workspace file operations are bounded to the selected workspace.
  Workspace-internal drag/drop Move remains experimental; New File, New
  Folder, Rename, and Move to Trash are the dependable file-tree
  operations.

## Implemented Surface Summary

- Safe open/edit/save for Markdown and text files, including LF / CRLF,
  final-newline, UTF-8 BOM, Shift-JIS, and EUC-JP handling.
- The sandbox-oriented direct save fallback preserves the normal atomic
  save path, and when direct write / sync fails after a partial write it
  attempts to restore the original bytes before reporting failure.
- Read-only preview for user-selected local PNG/JPEG/GIF/WebP image files
  up to 20 MB, including directly opened files outside the selected
  workspace.
- Clipboard image paste now rejects decoded PNG/JPEG/GIF/WebP payloads
  above the same 20 MB image boundary before allocating the decoded
  buffer; drag/drop image import keeps the existing 20 MB file-size cap.
- Multi-tab editor with dirty-tab close protection, app/window close
  confirmation, save-conflict recovery, and explicit draft recovery.
- No-workspace New File creates an untitled standalone Markdown tab
  without writing to disk. Save on a pathless untitled tab routes
  through Save As before writing, then the saved tab becomes an ordinary
  standalone file tab.
- The e-book right-pane toggle stays visible in the mode cluster when no
  active document is available, but is disabled and inactive until an
  editor document can drive the reading surface. Image preview keeps the
  control disabled even if a text tab remains open behind it, so stale
  prior-document content is not exposed from the button state.
- Normal Safe Editor chrome now exposes a main-chrome workspace sidebar
  toggle routed through the existing sidebar collapse flow. New File
  remains available through the native menu, keyboard shortcut, command
  palette, and bounded workspace-file actions rather than a tab-row `+`
  button.
- Auto-backup snapshots for a workspace file remain distinct even when
  multiple backups are captured in the same second; filenames include
  millisecond precision with a bounded collision suffix, and recovery
  listing stays newest-first.
- Normal Safe Editor mode can collapse and restore the left workspace
  sidebar without changing the file-tree model or L Mode drawer.
- The normal-mode status bar avoids duplicating the active `UTF-8` /
  `LF`-style format values in the passive detail when the trailing
  encoding and line-ending dropdowns already expose them.
- The misleading file-level Recent Files surface is removed from the
  start panel and native File menu. Legacy file-recent localStorage is
  cleared, while Recent Folders and explicit Open / Open Folder remain.
  Each newly opened recent folder now retains its own security-scoped bookmark:
  reopen tries the stored path and then that folder-specific grant. Legacy or
  stale entries return to the standard folder picker for one explicit
  reauthorization instead of leaving the raw sandbox `Operation not permitted`
  error visible. This remains bounded history, not startup scanning.
- The macOS About panel inherits canonical Tauri bundle metadata:
  publisher `Hazakura Lab` and
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`.
- Sanitized Markdown preview, local workspace image handling,
  standalone HTML export, and direct PDF export.
- e-book Mode is a display-only right-pane reading surface for the active
  Markdown document. It uses the existing Preview safety pipeline,
  heading-based chapter splitting, CSS Columns pseudo-pagination for the
  active chapter, and a fixed reader footer with chapter-local page
  progress. Markdown source remains canonical; the reader/editor bridge
  is source-line approximate rather than rendered-page exact. Whole-book
  page numbering remains deferred.
- EPUB export is available from the File menu and command palette as an
  explicit active-document export action. It writes a minimal
  `.epub` archive from the current Markdown source with XHTML content,
  generated heading navigation, dialog-scoped Title / Author / Language
  metadata, workspace image resources where readable, allowed small
  `data:image` resources, and a small stylesheet. The EPUB path strips
  Preview-only markup before XHTML output, handles inline Markdown in
  headings for navigation, ignores YAML frontmatter for export
  navigation/content, turns blank-line-flanked standalone `---` / `===`
  into explicit page-break hints, generates per-export UUID identifiers,
  and writes `dcterms:modified` from export time. It reports non-fatal
  image replacement warnings after successful export and uses the
  selected language metadata on generated XHTML. It is not a second
  document model and does not claim reader-perfect pagination, vertical
  writing, cover asset management, multi-file book ordering, or in-app
  validator proof.
- Markdown preview and Help document links keep supported
  workspace-relative text files inside the app, but route explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks to the OS default
  browser/app without navigating the main WebView.
- L Mode / えるモード as a source-preserving CodeMirror presentation
  layer, not a separate saved document model.
- Diff / explicit change review for active editor changes, recovery
  drafts, external-change conflicts, and Hazakura Local Assist edits.
- Hazakura Local Assist preview as an availability-gated, on-device
  writing assist surface. Presets insert visible, editable request text
  and generated results use explicit unsaved AI edit transactions. The
  published `0.29.1` App Store lane exposes it as a preview local AI
  writing companion; older installed App Store builds may still omit the
  helper until users update.
- Optional Developer / GitHub lane Agent Workbench, separated from and
  hidden in the App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.
- Theme selection (`light`, `dark`, `sakura`, `yakou`, `shokou`, and the
  `crt` joke theme) from the native View menu and the Preferences pane.
  `sakura` / `yakou` / `shokou` are seasonal ambient themes with particle
  effects; `crt` is a deliberately hard-to-read joke theme that overlays a
  WebGL CRT shader, scanlines, chromatic-aberration text, and
  mouse-reactive glitch on top of the editor. The shader is fully
  procedural (no external texture fetch, no `blob:` URL) and stays inside
  the existing CSP. Theme choice and ambient intensity are stored in
  `localStorage` alongside other display settings.

## M-0a Local Verification (2026-08-29)

Evidence covers local source and Xcode 26 builds on macOS 26.6.2. It does not
claim Xcode 27, `MLXLanguageModel`, a downloaded model, physical-device UI,
upload, tag, or release proof.

- Review range prepared for external review: `00f179ab..HEAD`.
- `npm run typecheck` — pass.
- `npm test` — 217 files / 1,832 tests pass.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 369 passed / 2
  host-dependent ignored.
- Fixture-selected `cargo test apple_assist_supervisor` — 32 passed. Coverage
  includes Rust System injection for generate + streaming and existing cancel
  child teardown.
- `npm run build:apple-assist-helper:fixture` — pass. Smoke accepts a missing
  backend and explicit System, and rejects Core AI / MLX / unknown with
  `unsupported_backend`.
- `npm run build:apple-assist-helper:live` — Xcode 26 arm64 / x86_64 / universal
  builds and System availability probe pass.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — helper-enabled local App Store preview bundle passes;
  existing large-chunk and no-notarization warnings only.
- `git diff --check` — pass after the evidence update.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/2.6.2-source-tag.release.md` (Mac App Store published;
  GitHub source tag still pending)
- `docs/releases/2.6.2-app-store-release-notes.md` (What's New for published
  `2.6.2`; user-confirmed 2026-08-28, staged rollout)
- `docs/releases/2.6.1-source-tag.release.md` (prior local candidate)
- `docs/releases/0.36.0-app-store-release-notes.md`
- `docs/releases/0.35.0-app-store-release-notes.md`
- `docs/releases/0.32.0-app-store-submission-candidate.release.md`
- `docs/releases/0.31.0-app-store-submission-candidate.release.md`
- `docs/releases/0.29.1-app-store-submission-candidate.release.md`
- `docs/releases/0.27.0-source-tag.release.md`
- `docs/releases/0.28.0-app-store-submission-candidate.release.md`
- `docs/releases/0.27.0-app-store-submission-candidate.release.md`
- `docs/releases/0.26.0-source-tag.release.md`
- `docs/releases/0.26.0-app-store-submission-candidate.release.md`
- `docs/releases/0.25.0-source-tag.release.md`
- `docs/releases/0.25.0-app-store-submission-candidate.release.md`
- `docs/releases/0.19.0-source-tag.release.md`
- `docs/releases/0.20.0-app-store-submission-candidate.release.md`
- `docs/releases/0.20.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.18.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.17.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.16.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.15.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.14.0-source-tag.release.md`
- `docs/releases/0.13.0-source-tag.release.md`
- `docs/releases/0.12.0-source-tag.release.md`

For future releases, use:

- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/release-pre-check.md`
- `docs/smoke-checklist.md`

The detailed v0.17 App Store-quality queue, closeout, performance
baseline, and smoke evidence are archived under
`docs/archive/operations/app-store-v0.17/`.

## Planning Sources

- `docs/roadmap.md`: **v2 development phase** (active); residual/evidence parked.
- `docs/current-work.md`: **v2 slice queue**.
- `docs/v2.9-v3-local-assist-plan.md`: **現行の版別計画**。
- `docs/v2.8-plan.md`: 公開済み版の計画履歴。
- `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`: v2 design SoT.
- `docs/releases/2.0.0-app-store-release-notes.md`: published store notes for
  `2.0.0` (user-reported 2026-07-21).
- `docs/releases/2.3.0-app-store-release-notes.md`: local Book UX (recipe + resume) candidate
  notes; manual installed/TestFlight gate pending.
- `docs/releases/2.6.2-source-tag.release.md`: Local Assist conversation /
  Diff candidate, right-pane ownership fix; Mac App Store published, GitHub
  source tag still pending.
- `docs/releases/2.6.1-source-tag.release.md`: prior 2.6.1 local candidate.
- `docs/releases/2.7.0-source-tag.release.md`: frozen build 123 boundary;
  owner-managed App Review planned, Apple-side state unconfirmed.
- `docs/releases/2.1.0-app-store-release-notes.md`: historical notes for the
  folded whole-book search + Preview image-hardening slice.
- `docs/releases/2.0.0-source-tag.release.md`: `v2.0.0` source-tag boundary.
- `docs/releases/1.14.0-source-tag.release.md`: intermediate `v1.14.0` source tag.
- `docs/releases/1.14.0-app-store-release-notes.md`: intermediate `1.14.0` store
  copy (live listing superseded by `2.0.0`).
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/ebook-mode-epub-export-plan.md`: e-book Mode / EPUB export
  planning and source-preserving reader/export boundaries.
- `docs/assist-surface-strategy.md`: assist-surface direction.
- `docs/v1.8-plus-product-review-roadmap.md`: completed v1.8–v1.12 bridge.
- `docs/v1.10-single-document-structure-design.md`: completed v1.10 structure contract.
- `docs/v1.11-okf-draft-preview-design.md`: completed v1.11 implementation and verification contract.
- `docs/v1.12-okf-scaffold-design.md`: closed / published v1.12 contract.
- `docs/v1.13-plus-refinement-roadmap.md`: **parked** refinement theme pools.
- `docs/v1.13-interaction-clarity-plan.md`: Theme A candidate pool (historical for main queue).
- `docs/okf-spec-pin.md`: shared OKF pin for review + scaffold + v2 inputs.
- `docs/app-store-build.md`: public-safe App Store build/signing boundary.

## Local 2.6.1 Candidate Evidence (2026-08-27)

Recorded against `main` at `6ff22dad` plus this notes pass. Details:
`docs/releases/2.6.1-source-tag.release.md`. Not a tag, upload, or physical
Assist UI claim.

- TypeScript/Vitest **213 files / 1,819 tests**, App Store surface **10 files /
  111 tests**, Vite, `cargo fmt --check`, and Rust **368 pass / 2 ignored**.
- `npm audit` 0 vulnerabilities; `cargo audit` 18 allowed warnings, no
  high/critical.
- Fixture helper smoke ok; live helper probe `available` on this host.
- Helper-enabled App Store preview app built as `2.6.1` /
  `dev.hazakura.editor`; bundled notices present; native window `1280x820`
  opened and quit cleanly. Ad-hoc `spctl` Insufficient Context is expected.
- Release-pre-check hygiene on `v2.3.0..6ff22dad` found no blocking path or
  secret. A local TestFlight-shaped `.pkg` already exists in ignored
  provenance.

## Local 2.6.2 Candidate Evidence (2026-08-27)

Recorded against source `23d44fdf` (P1: in-pane Diff retains Reference).
Details: `docs/releases/2.6.2-source-tag.release.md`. Not a tag, upload, or
physical Assist UI claim.

- App Store surface **10 files / 111 tests**; `tsc --noEmit` pass.
- P1 tests: in-pane Diff hides Reference without discarding the session;
  参照 restores the same load without a picker.
- Local MAS pkg `2.6.2` / build `122` signed from `23d44fdf`. Builds `120`
  (HOLD: in-pane Diff discarded Reference) and `121` (gutter polish only)
  are superseded. Do not treat the local pkg as uploaded.
- Physical 確認-with-Reference and in-pane 差分 → 参照 restore remain
  smoke-checklist item 20.

## Next Safe Actions

1. `docs/current-work.md` を読み、公開後の次のスライス（残課題の判断、またはv3.1準備）を選ぶ。
2. v3.0のSystem共通基盤とv3.1のC-1/C-2を区別し、`docs/core-ai-c0-design.md` のゲートを守る。
3. 実モデル、native窓、IME/VoiceOver、旧OS/署名済みbundleは各実装時に該当範囲を検証。
4. 縦書き・anydoc・MLX runtime・背景index・永続チャットは主キューへ混ぜない。
5. 公開済み版やタグ（`v3.0.0`を含む）を変更せず、新しい提出・公開は別工程とする。
