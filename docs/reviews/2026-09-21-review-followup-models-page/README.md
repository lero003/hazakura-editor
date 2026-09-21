# 外部レビュー追補: モデルページの遷移と生成設定の購読

Status: Evidence（source / test、実表示は fixture）
Scope: `213f6d0e`（モデル独立ページ）と `de3a2310`（生成設定の実効値表示）への指摘2件と、システムメニューの入口
Authority: 検証記録
Last reviewed: 2026-09-21

外部レビューの P2 2件を直し、同時に「設定から独立したシステムメニューの入口」を足した。
P1 は指摘なし。独立ページ化そのものと、値の出所（Rust の記録のみ）は変更していない。

## P2-01: ページ切替後にフォーカスが行き先を失う

設定本文の入口は切替でボタンごとアンマウントされるため、押した後にフォーカスが
`body` へ落ちていた。`OnDeviceModelsPane` の見出しを `tabIndex={-1}` の受け皿にし、
マウント時に次の規則で移す。

- 設定本文の入口から来た（＝直前のフォーカスがヘッダー外）: 見出しへ移す。
- ヘッダーの選択から来た（＝選択が生きている）: 選択にフォーカスを残し、奪わない。

回帰テストは実コンポーネントで、入口ボタンへ実際にフォーカスしてから切り替え、
**次の Tab を押す前に**フォーカスが移っていることを見る（`OnDeviceModelsPane.test.tsx`）。
修正を外すとこのテストだけが落ちることを確認した（red → green）。

## P2-02: 初回取得と通知登録の競合

`CoreAiGenerationProfile` は「先に取得、あとで購読」だったため、購読が終わる前の生成を
取り逃し得た。また、通知で新しくなった後に、保留中だった古い取得結果が表示を巻き戻し得た。

順序を **購読 → スナップショット** に変え、通知が届いたことを `generation` で数えて、
取得中に通知があれば取得結果を採用しないようにした。購読に失敗した場合は
スナップショットだけを表示し、読めなければ空状態のままにする（診断面としての従来方針は不変）。

回帰テストは購読と取得を未解決 Promise にして順序と後着を制御する
（`CoreAiGenerationProfile.test.tsx`）。修正を外すと新規2件が落ちることを確認した（red → green）。

## 設定から独立したシステムメニューの入口

`MENU_ON_DEVICE_MODELS`（`on-device-models`）を追加し、macOS ではアプリメニュー
（Hazakura Editor）の「設定...」の隣、その他の OS では File の「設定...」の隣に置いた。
押すと `setPreferencesDialogMode("models")` で **設定本文を経由せずモデルページを直接開く**。
lane 制限は付けない（Apple Local Assist はどのレーンでも許可される）。
かなが表示言語のときは「おんでばいますもでる...」を返す。

modal が入力を握っているときの既存規則（非 Quit のメニュー操作は捨てる）はそのまま適用される。

## 確認したこと

- `cargo test` — 424 passed / 2 ignored（+2: メニュー項目と allowlist）。
- `cargo fmt --check` — pass。
- `npm test` — 297 files / 2,659 tests pass（+5: フォーカス2・購読競合2・メニュー経路1）、
  `test:scripts` 24 pass。
- `npm run typecheck`、`npm run build:vite`、`npm run smoke:app-store-surface`（130）— pass。
- `npm run build`（App Store preview レーン）— 成功（メニュー変更を含む release バンドル）。
- CI の native job と同じ手順も埋めた: `npm run build:apple-assist-helper:fixture` /
  `npm run build:import-assist-helper:fixture`（どちらも smoke ok）、
  `swift test --package-path src-helpers/apple-assist`（46 tests pass）。
- `git diff --check` — clean。

## 未確認・注意

- **CI はこのブランチでは走らない。** `.github/workflows/quality.yml` は `pull_request` と
  `main` への push だけをトリガーにしているため、`213f6d0e` に check-run が0件なのは
  失敗ではなく未実行。PR を開くか `main` へ入れて初めて quality / native が動く。
- システムメニューの実表示（ネイティブメニュー項目、Cmd+, との並び、かな表示）は
  built app での手動確認が残る。source test は id の配線と allowlist までしか見ていない。
- built app でのフォーカス移動、VoiceOver、最大 Dynamic Type も未実施。
- ライセンス表示、削除時の解放サイズ、マシンスペック事前警告は未着手のまま。

## 2巡目（`540affc7` への指摘）

### P2: 見出し着地後の Tab 順序（修正済み）

見出しは `tabIndex={-1}` なので `getFocusableElements()` の一覧に入らない。
`trapFocusInElement` は「一覧に無い」を「ダイアログ外へ抜けた」と同じ扱いにしていたため、
見出しに着地した直後の Tab がヘッダーのページ選択へ戻り、Shift+Tab が本文の最後へ飛んでいた。

一覧に無い場合を **ダイアログ内（`tabIndex=-1` の受け皿）** と **ダイアログ外** に分け、
前者はその要素の DOM 位置から次の/前の Tab 対象へ進める（端では従来どおり先頭・末尾へ折り返す）。
ダイアログ外の挙動は変えていない。

回帰テストは2段階で足した。

- `focusTrap.test.ts`: 一覧に無い受け皿の前後移動と、末尾での折り返し。
- `OnDeviceModelsPane.keyboard.test.tsx`: **実際の `PreferencesDialog` と `useModalKeyboardGuard`**
  の組み合わせで、見出しへ着地 → Tab で本文の最初の操作対象、着地 → Shift+Tab で
  見出しの直前（ヘッダーの閉じる）へ入ることを確認する。指摘どおり「着地まで」ではなく
  「着地した次の一歩」まで見る。

分岐を旧挙動へ戻すと、上記の unit 1件と integration 1件が落ちることを確認した（red → green）。

### P3: かなラベルの誤字（修正済み）

「おんでばいますもでる...」→「おんでばいすもでる...」。`menu.rs` と期待値テストを同時に直した。

### 2巡目の確認

- `cargo test` — 424 passed / 2 ignored、`cargo fmt --check` pass。
- `npm test` — 298 files / 2,662 tests pass（+1 file / +3 tests）、`test:scripts` 24 pass。
- `npm run typecheck`、`npm run build:vite` — pass。

### マージ手順の訂正（レビュー指摘）

`gh pr merge --match-head-commit` は「PR の HEAD が指定 SHA と一致すること」を確認するガードで、
fast-forward を指示するオプションではない。GitHub の通常マージはマージコミットを作り、
Squash / Rebase merge は SHA を書き換える。**元の SHA を保った厳密な FF-only が要るなら**、
PR とは別にローカルで

```bash
git checkout main && git merge --ff-only codex/core-ai-phase1 && git push origin main
```

のように行う（このブランチは `main` の直系なので FF できる）。PR を使う場合は
「CI を緑にしてから、どのマージ方式を選ぶか」を別途決める。

### PR の CI で見つかったこと: ローカル tsc の死角

PR #52 の frontend job が
`SettingsCategoryRail.test.tsx` の `onOpenOnDeviceModels` 欠落で落ちた。ローカルの
`npm run typecheck` は通っていたが、原因は**大文字小文字だけが違うファイル名の衝突**だった。
同じディレクトリに `settingsCategoryRail.test.ts`（純関数の unit）と
`SettingsCategoryRail.test.tsx`（DOM テスト）があり、case-insensitive な macOS では
TypeScript の `include` が後者を program から落とす。Linux の CI は両方を見るため、
ローカルでだけ通っていた。

対処:

- DOM テストを `SettingsCategoryRailDom.test.tsx` へ改名し、`onOpenOnDeviceModels` を渡した
  （改名でローカルの `--listFiles` にも現れ、CI と同じ失敗を再現してから緑にした）。
- 参照していた `docs/reviews/2026-09-10-v3-ui-g2/README.md`、
  `docs/reviews/2026-09-10-v3-ui-g2-g4-review-request.md`、`src/styles/dialogsCss.test.ts`
  のコメントを更新。
- 再発防止として `docs/development-automation.md` の Verification に、同名衝突を避ける
  注意と `--listFiles` での確認方法を書いた。

### PR の CI で見つかったこと: native job は macOS 27 SDK を要求する

同じ PR の `native` job は、**このブランチ固有の理由**で落ちる。ログ:

```txt
native/background_assets_bridge.m:125:46: error: no visible @interface for 'BAAssetPackManifest' declares the selector 'assetPackWithIdentifier:'
native/background_assets_bridge.m:118:18: error: no visible @interface for 'BAAssetPackManager' declares the selector 'getManifestWithCompletionHandler:'
thread 'main' panicked at build.rs:67:5
Process completed with exit code 101.
```

- 原因: `background_assets_bridge.m` は `@available(macOS 27, *)` で実行時分岐しているが、
  呼んでいる `getManifestWithCompletionHandler:` / `assetPackWithIdentifier:` は
  **macOS 27 SDK の宣言が要る**。CI の runner は `runs-on: macos-26` で、その SDK には
  この selector が無いため、`build.rs` の ObjC コンパイルで落ちる。
- 由来: ブリッジは `240474b6`（Core AI の Apple-hosted E4B 取得経路、2026-09-21）で入った。
  このブランチは feature ブランチだったため、それまで CI が走っていなかった。
- 影響: `main` の CI は緑（`7c2b5f1e` で success）。**このブランチを今 `main` へ入れると
  `main` の native job が赤になる。**
- 注意: 手元には macOS 27 SDK しか無い（`MacOSX27.0.sdk` / `MacOSX27.sdk`）ため、
  SDK ガードの「古い SDK 側」をローカルでコンパイル検証することはできない。
  `-D__MAC_OS_X_VERSION_MAX_ALLOWED=260000` の上書きも SDK 側で再定義され効かなかった。

選択肢（未着手。distribution lane の判断が要る）:

1. `#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 270000` で 27 専用呼び出しを囲み、
   古い SDK では既存の `@available` else と同じ「unsupported」を返す。検証は CI の
   macOS 26 runner が担う（ローカルでは 27 側しか確認できない）。
2. native job を macOS 27 の runner に移す（現時点で GitHub-hosted にあるかは未確認）。
3. native が赤のまま PR を保留し、App Store / TestFlight 側の作業と同じタイミングで扱う。
