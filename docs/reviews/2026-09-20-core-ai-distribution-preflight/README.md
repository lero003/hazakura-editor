# Core AI distribution preflight

Status: Implemented and locally verified
Date: 2026-09-20
Scope: App Store / TestFlight build shape before publishing a production model asset

## 結論

配布buildへCore AI production adapter、空catalogのモデル管理、Rust-owned選択を接続した。
System helperは従来の互換範囲を維持し、Core AIはmacOS 27+専用の別sidecarに分離した。
本番catalogは意図的に空なので、現在のUIはCore AIモデル未公開を表示し、
Apple Intelligenceだけを選べる。モデルweightsやDeveloper Qwen fixtureは同梱しない。

## 実装した境界

- `hazakura-core-ai-helper`をApp Store preview / submitの`externalBin`へ追加した。
- Apple `coreai-models`を固定revisionと固定lockでarm64 adapterへlinkした。
- Core AIのx86_64 sliceはinert。Rustはreadyなinternal catalog entryがない限り選択しない。
- 設定にdownload / cancel / deleteを見据えた管理面、Local Assist窓にモデルpickerを接続した。
- Rustだけがapp-privateな選択とmodel pathを所有する。frontendはidだけを渡し、任意URL/pathを渡せない。
- production catalogは空。download / cancel / deleteはApple-hosted asset transport有効化までfail closed。
- System / Core AIのどちらもProposal → Diff → 明示Apply → 未保存 → Undoの既存契約を変えない。
- App Store disclosure / Privacy Policyは、将来の明示的なApple-hosted model acquisitionと
  オンデバイス推論を区別した。

## 初回実装の検証（de911cec）

- Swift helper tests: 21 passed。
- Rust: 400 passed / 2 ignored（対話macOS環境依存）。single-threadで実行。
- frontend: 295 files / 2,630 tests passed。
- App Store surface: 10 files / 128 tests passed。
- `npm run typecheck`、`cargo fmt --check`、`npm run build`成功。
- local ad-hoc App Store preview bundleに3 helperとnoticeが入り、deep codesign verify成功。
- bundle内arm64 Core AI helperのdeployment targetはmacOS 27.0。System helperはCore AI dependencyを持たない。

最初の`npm run build`ではImport Assist buildのBSD `mktemp` suffix問題を再現した。
一時ログtemplateをmacOS互換へ直し、回帰test追加後の再buildが成功した。

## 外部レビューP2追補（2026-09-20）

- P2-01: 起動時の選択をモデル管理初期化へ集約。Developerの明示指定を保存済み本番選択より
  優先し、テスト指定を永続化しない。App Storeでは指定を無視する。catalogがSystemだけでも
  Local Assistはnativeのテストモデル名を表示する。指定中は管理による切替をロックする。
- P2-02: app-data解決・保存先作成・選択読込・無効ID修復の失敗をsetupへ返さず、
  `managementError`に保持する。先にSystem（Developer明示指定ならそのbackend）を選び、
  設定で原因と「文書の編集は続けられる」を表示。管理操作だけを無効化する。
- 隣接修正: 選択ファイルの保存成功後にruntimeを切り替える。保存失敗・生成予約中は
  以前の選択を保ち、複数窓の書込を直列化する。新モデルのprobe中は旧モデルのavailabilityを使わない。
- red確認: Rust 4件（テスト選択の上書き、保存先作成失敗、修復失敗、切替保存失敗）、
  frontend 4件（picker、Local Assist窓、管理エラー表示、再probe）が修正前に失敗した。
- green確認: Rust全411 passed / 2 ignored、frontend全295 files / 2,635 tests、
  App Store surface 128件、typecheck、Rust format、diff check成功。
- 修正後の`npm run build`も成功。最初は実行sandboxがSwiftのdSYM生成を拒否したため、
  承認された通常ローカル権限で再実行した。`probe:macos-distribution`で3 helper、notice、
  deep signatureを確認した。ad-hoc previewであり、Apple Distribution署名やuploadはしていない。
- 障害注入は一時ディレクトリ内のfile/directory衝突とapp-data解決エラーで行った。
  実利用者の保存先や権限は変更していない。実機での障害起動・Core AI生成・IME・VoiceOver、
  TestFlight/CDNはこの追補では未確認。初回のSwift単体21件は今回の再実行結果ではない。

## 未完了

- 本番model identity、権利/provenance、品質bake-off
- AOT済みasset、archive digest、展開後resource manifest
- Background Assets downloader extension、App Group、Info.plist、provisioning profile
- App Store Connectへのasset pack upload / processingとcatalog entry公開
- download進捗 / cancel / removalの実transport
- Swift依存とmodel licenseの最終notice bundle
- Apple Distribution署名pkg、upload、TestFlight processing、実機/VoiceOver/IME受入

このローカルpreview成功を、署名済みTestFlight候補やApple CDN上のmodel availabilityとして扱わない。
