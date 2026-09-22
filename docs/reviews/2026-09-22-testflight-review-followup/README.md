# TestFlight前 外部レビュー追補

Status: Evidence（source / automated tests / Vite fixture）
Scope: `aac6e900`への外部レビューP2 6件と設定画面の小改善
Authority: 検証記録
Last reviewed: 2026-09-22

P1の指摘はなく、TestFlight最終受入候補にする前のP2 6件を閉じた。モデルの配布catalog、
production lock、任意URL/pathを受けない境界、明示Applyは変更していない。

## 閉じた指摘

1. **streaming prompt marker:** markerの全prefixを途中表示から隠し、最終候補は最後のraw
   snapshotだけから作る。途中で得た古い候補を最終成功へ流用しない。原稿自身のmarkerと通常の
   `<...>`は保持する。
2. **catalog競合:** 設定画面とLocal Assist窓を共通の`useCoreAiModelCatalog`へ寄せた。
   購読完了後にsnapshotを取り、event後に届く古いsnapshot/操作応答、後発requestより古い応答を
   採用しない。購読失敗時はsnapshotだけで継続する。
3. **manifest解決中のcancel:** Background Assets操作をmodel共通のserial queueへ載せ、操作世代を
   start/retryごとに更新する。cancelは世代を無効化してから戻り、未生成の`BADownload`がなくても
   解決中の論理取消として成功する。古いmanifest/completion callbackは状態もdownloadも開始しない。
4. **paused監視:** `Paused`をmonitorの終了条件から外し、5秒間隔で監視を続ける。同一modelで新しい
   monitorを始めた場合は古い世代が終了する。OS側だけで`paused → downloading → ready`へ戻れる。
5. **選択中modelの削除失敗:** remove前にSystemへ退避する契約は維持し、remove失敗時は元modelを
   helper・保存値・storeへ復元する。復元できない場合もcommandは実catalogを必ずemitして、rendererを
   helperと食い違わせない。
6. **model picker focus:** 開いた直後だけ選択modelへfocusする。進捗だけの再描画では現在focus中の
   modelを維持し、そのmodelが削除・disabledになった場合だけ選択中または最初の利用可能modelへ移す。

## 設定画面

- ページ上部に現在のmodelと物理メモリを表示する。
- ready前の展開後サイズは「インストール後 約...」、ready後だけ「使用量 約...」とする。
- Apple Intelligenceは「システム標準 / 利用状況未確認」とし、可用性を断定しない。
- 「直近の生成記録」は既定で閉じたdisclosureにする。
- 削除前にmodel名、概算解放量、再download可能、選択中ならApple Intelligenceへ戻すことを確認する。

## 確認したこと

- `npx vitest run --maxWorkers=1` — 298 files / 2,674 tests pass。
- `npm run test:scripts` — 24 tests pass。
- `cargo test --manifest-path src-tauri/Cargo.toml` — 427 passed / 2 ignored。
- `swift test --package-path src-helpers/apple-assist` — 52 tests pass。
- `npm run typecheck`、`npm run build:vite`、`cargo fmt --check`、`git diff --check` — pass。
- `npm run smoke:app-store-surface` — 132 tests pass。
- Objective-C bridgeをmacOS 26 deployment target、現在のmacOS 27 SDK、`-Werror`で
  `xcrun clang -fsyntax-only`し成功。
- `npm run build` — App Store preview appとBackground Downloader extensionのbuild、埋め込み、
  ad-hoc署名検証が成功。既存のSwift deprecated API / x86_64 / Vite chunk警告は残る。
- 実装commit `a16b0971`のPR #52 Quality run `35664620124` — frontend / nativeとも成功。
  確認時のmerge stateは`CLEAN`。PRの最新check-runはGitHubを正本とする。
- 本物の`PreferencesDialog` / `OnDeviceModelsPane`と模擬IPCのVite fixtureを狭い日本語画面で確認。
  要約行、System表示、12B警告、ready前後のサイズ文言、折りたたみ/展開に重なりなし。

既定worker数の`npm test`は、Rust/Swiftとの並行実行時と単独再実行時に既存の重いDOMテストが
時間切れし、終了待ちになったため中断した。落ちた4 files / 116 testsは単独で全件成功し、
全frontendは`--maxWorkers=1`で成功した。これは成功した安定条件と分けて記録する。

## 外部再レビュー後のブランチ状態

- 2026-09-22にローカルで上記ゲートを再実行し、同じ結果を確認した（frontend 298 files /
  2,674 tests、`test:scripts` 24 tests、Rust 427 passed / 2 ignored、Swift 52 tests、
  surface 132 tests、`typecheck` / `build:vite` / `cargo fmt --check` / `git diff --check`）。
  Objective-C bridgeはmacOS 26 deployment target、macOS 27 SDK、`-Werror`で
  `xcrun clang -fsyntax-only`が成功した。
- Swift toolchainはCodex seatbelt内だとmodule cacheを作れずsandbox-execが拒否されるため、
  `build:apple-assist-helper:fixture` / `build:import-assist-helper:fixture`と
  `swift test`はsandbox外で実行した（各smokeの出力を確認）。
- PR #52は`e18c102d`時点でQuality run `35665281992`がfrontend / nativeとも成功し、
  merge stateは`CLEAN`。**マージ前の最終確認は最新HEADのcheck-runをGitHubで見る。**
- 証跡commit `325833fb`をPR #52へpushし、Quality run `35670541634`がfrontend（3m4s）/
  native（3m43s）とも成功、merge stateは`CLEAN`。GitHubの脆弱性通知2件（moderate、
  default branch）はDependabotの既知項目で、この差分の変更ではない。

## 未確認

- built app / WKWebViewでの設定表示、削除確認、model pickerの実キーボード操作。
- VoiceOver、最大文字サイズ、sleep/wakeを挟むpaused自動復帰。
- 実Background Assetsのmanifest解決中cancel/retry、削除失敗、CDN materialization。
- 32 GB対象機の12B、Internal TestFlight、署名提出物、App Store受入。
