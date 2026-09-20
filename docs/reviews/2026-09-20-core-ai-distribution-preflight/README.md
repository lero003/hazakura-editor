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

## 検証

- Swift helper tests: 21 passed。
- Rust: 400 passed / 2 ignored（対話macOS環境依存）。single-threadで実行。
- frontend: 295 files / 2,630 tests passed。
- App Store surface: 10 files / 128 tests passed。
- `npm run typecheck`、`cargo fmt --check`、`npm run build`成功。
- local ad-hoc App Store preview bundleに3 helperとnoticeが入り、deep codesign verify成功。
- bundle内arm64 Core AI helperのdeployment targetはmacOS 27.0。System helperはCore AI dependencyを持たない。

最初の`npm run build`ではImport Assist buildのBSD `mktemp` suffix問題を再現した。
一時ログtemplateをmacOS互換へ直し、回帰test追加後の再buildが成功した。

## 未完了

- 本番model identity、権利/provenance、品質bake-off
- AOT済みasset、archive digest、展開後resource manifest
- Background Assets downloader extension、App Group、Info.plist、provisioning profile
- App Store Connectへのasset pack upload / processingとcatalog entry公開
- download進捗 / cancel / removalの実transport
- Swift依存とmodel licenseの最終notice bundle
- Apple Distribution署名pkg、upload、TestFlight processing、実機/VoiceOver/IME受入

このローカルpreview成功を、署名済みTestFlight候補やApple CDN上のmodel availabilityとして扱わない。
