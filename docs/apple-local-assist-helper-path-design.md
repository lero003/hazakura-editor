# Apple Local Assist — Bundled Helper Path 設計メモ

Status: Draft (slice 16, supervisor skeleton wired in slice 17)
Scope: `src-tauri/src/commands/apple_assist_supervisor.rs` の `helper_path()` が、production で将来どの bundled helper path を見るべきかの設計。`tauri.conf.json` / `bundle.externalBin` / `minimumSystemVersion` / signing / entitlements は未承認のため、まだ production で spawn 可能にはしない。
Authority: Medium
Last reviewed: 2026-06-05

## 目的

Rust supervisor は v0.12.0 の時点で `binaries/hazakura-apple-assist-helper-<rust-triple>` を spawn する設計で止まっている。これは "fixture build を `binaries/` に置いて `cargo test` から spawn する" 経路としては成立するが、Tauri の `bundle.externalBin` 承認前夜の production 経路としては何も決まっていない。本メモは **gate-flip に入った瞬間に差し替える helper path の形** を pin し、sandbox / signing / notarization に進む前に確認すべき項目を列挙する。production の `helper_path()` は **本スライス (slice 16-17) ではまだ `Err` を返し続ける** ことが gate-default-hidden 契約の本体。

## 結論 (slice 16)

- **expected helper filename**: `hazakura-apple-assist-helper-<rust-target-triple>` (例: `hazakura-apple-assist-helper-aarch64-apple-darwin`)。`scripts/build-apple-assist-helper-fixture.sh` の DEST 命名と一致させる (Tauri sidecar convention)。
- **app bundle 内配置**: Tauri 2 の `bundle.externalBin` 承認後は、macOS app bundle の `Contents/MacOS/` 直下に helper がコピーされる。Tauri は sidecar を `Contents/MacOS/<name>-<triple>` として配置し、production runtime は `std::env::current_exe()` の親ディレクトリを起点に `<name>-<triple>` を探す形が standard。Rust 側は `current_exe().parent()` 配下を探索する resolver を `helper_path()` 内に持つ。
- **dev / test / packaged build の違い**:
  - **dev** (`npm run tauri dev`): `tauri.conf.json` の `bundle.externalBin` が未設定なので、Tauri は helper を `Contents/MacOS/` にコピーしない。fixture binary は手動で `binaries/hazakura-apple-assist-helper-<triple>` に置いて `cargo test` から `store_with_helper_path` で注入する経路しか動かない (現状の slice 8-18 と同一)。dev で supervisor 経路を end-to-end で試したい場合も `store_with_helper_path` を使う (production `Default` は env var を読まないため、明示的なテスト fixture 注入が必要)。
  - **test** (`cargo test --manifest-path src-tauri/Cargo.toml`): `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var で fixture binary path を渡し、`store_with_helper_path` 経由で supervisor に注入。production `Default` は env var を読まない (slice 14+ の回帰テストで固定)。
  - **packaged build** (DMG preview / App Store build / developer build): `bundle.externalBin` が `tauri.conf.json` に追加され、Tauri が `Contents/MacOS/hazakura-apple-assist-helper-<triple>` を app bundle に同梱する。production `helper_path()` が `current_exe().parent()` 配下の該当 filename を探す。これが gate-flip 後の正式経路。
- **missing helper 時の error message**: 現状の `Err("Apple Assist helper is not configured for this build.")` を `Err("Apple Assist helper binary 'hazakura-apple-assist-helper-<triple>' was not found next to the running executable: <full-path>.")` のように "どこを探して、見つからなかった" を含む形に拡張する。packaged build で `externalBin` を間違って外した / build artifact が壊れた / 別 OS のバイナリを誤って同梱した、を運用時にデバッグしやすくする。
- **App Store sandbox / signing / notarization に入る前の確認項目**: 末尾の "Pre-flight checklist" を参照。

## 想定する production `helper_path()` の形

`slice 17` で supervisor.rs に追加する skeleton は次の流れ:

```rust
// production resolver skeleton (slice 17, NOT yet wired into spawn)
// 1. `rust_target_triple()` で host triple を返す (aarch64-apple-darwin / x86_64-apple-darwin)
// 2. `bundled_helper_filename()` で `hazakura-apple-assist-helper-<triple>` を返す
// 3. `resolve_bundled_helper_path()` は production で `current_exe().parent()` 配下を探索
//    - ただし slice 17 時点では `Err("Apple Assist helper is not configured for this build.")` を返す
//    - gate-flip 承認スライスで実探索に差し替える
//
// 呼び出し順:
//   helper_path() {
//     #[cfg(test)] { if helper_path_override: return ... }
//     resolve_bundled_helper_path()  // 現時点では not-configured を返す
//   }
```

`resolve_bundled_helper_path()` の最終形 (gate-flip スライスで実装):

1. `std::env::current_exe()` で実行中バイナリのパスを取得。
2. `.parent()` を base にする (macOS app bundle の `Contents/MacOS/<main-binary>` から 1 つ上)。
3. base に `bundled_helper_filename()` を連結 → `candidate: PathBuf`。
4. `candidate.exists() && candidate.is_file()` なら `Ok(candidate)`。
5. 見つからなければ `Err(format!("Apple Assist helper binary '{}' was not found next to the running executable: {}.", filename, candidate.display()))`。

`current_exe()` 起点にする理由:

- Tauri 2 の `bundle.externalBin` は sidecar を `Contents/MacOS/<name>-<triple>` に配置する規約なので、`current_exe().parent()` から直線的にたどれる。
- `std::env::current_dir()` を使うと、launcher や terminal から起動されたときに CWD に依存してしまう。
- `$BUNDLE_RESOURCE_DIR` 系の Tauri API も候補だが、`externalBin` 経路では binary として配置されるため `current_exe()` ベースで十分。

## dev / test / packaged build の違い — 運用上のポイント

| 経路 | 用途 | helper の居場所 | production `helper_path()` の挙動 | テストの注入経路 |
|---|---|---|---|---|
| dev (`npm run tauri dev`) | 開発者の iteration | `binaries/hazakura-apple-assist-helper-<triple>` (fixture build の置き場) | `Err("not configured")` (gate-default-hidden 維持) | `store_with_helper_path` で明示注入 |
| test (`cargo test`) | supervisor の integration test | `std::env::temp_dir()` の一時 shell script + `binaries/hazakura-apple-assist-helper-<triple>` (env var 経由) | `Err("not configured")` | `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var + `store_with_helper_path` |
| packaged build (DMG preview) | ローカル動作確認 (ad-hoc signed) | Tauri が `Contents/MacOS/hazakura-apple-assist-helper-<triple>` に同梱 (gate-flip 承認後) | `Ok(current_exe().parent() / filename)` (gate-flip 承認後) | n/a (production 経路) |
| packaged build (developer build) | developer-signed 配布 | 同上 | 同上 | n/a |
| packaged build (App Store) | Mac App Store 提出 | 同上 + 公証 / signing | 同上 | n/a |

**現状 (slice 18 まで)**: dev / test / packaged build のいずれも production `helper_path()` は `Err` を返す。supervisor が Tauri command body から呼ばれるのは gate-flip スライスで、そのときは packaged build の経路だけ production 経路として動く想定。dev / test では `store_with_helper_path` 経由 (test fixture) または明示的な fixture 配置 (dev) を継続する。

## Missing helper 時の error message 設計

production 経路で helper が見つからなかった場合の error メッセージは次の形にする:

- **gate-flip 後の production 経路 (resolve_bundled_helper_path)**: `Err("Apple Assist helper binary 'hazakura-apple-assist-helper-<triple>' was not found next to the running executable: <absolute-path>. (If you are running a development build, build the helper fixture with 'npm run build:apple-assist-helper:fixture' and place it next to the running binary; packaged builds should ship the helper via tauri.conf.json bundle.externalBin.)")`
  - 長くなるが、`current_exe().parent()` の絶対パス、探した filename、dev / packaged それぞれの復旧ヒントを含める。
  - Rust 側の `spawn_locked` → `format!("Failed to spawn Apple Assist helper: {e}")` に連結されるが、helper 自体が missing なら spawn 前にこの `Err` で return する。
- **現状 (gate-default-hidden 維持)**: `Err("Apple Assist helper is not configured for this build.")` (現状のまま。slice 17 で `resolve_bundled_helper_path` が not-configured を返すように構造を整理するだけで、メッセージは変えない)。

error メッセージの安定性:

- production 経路の文言は "file not found" 形式を保ち、OS error message (`os error 2` 等) を露出しない。理由は 2 つ: 1) エンドユーザー向けではないので技術詳細を控えめに、2) UI 側で reason 文字列を localized message にマップする余地を残す。
- "not configured" は slice 1-6 から pin してきた message で、UI 側 (`useAppleAssistAvailability` 等) が `reason.includes("not configured")` で分岐している可能性があるので、gate-flip 前は変えない。

## App Store sandbox / signing / notarization に入る前の確認項目

gate-flip 承認 (順序 14 相当) → `tauri.conf.json` の `bundle.externalBin` 追加 → App Store sandbox での sidecar spawn 検証、と進む前に確認すべき項目。**これらは本スライス (16) では着手せず、gate-flip 承認が降りたスライスのチェックリストとして残す。**

- [ ] `tauri.conf.json` の `bundle.externalBin` に `binaries/hazakura-apple-assist-helper-<triple>` を含める (明示承認が必要)
- [ ] `minimumSystemVersion` の bump: Foundation Models は macOS 26+ SDK 必須なので、必要なら bump する (明示承認が必要)
- [ ] helper の Developer ID signing: ad-hoc ではなく Developer ID Application 証明書で署名
- [ ] helper の notarization: `notarytool` で `developer-id` profile に submit、公証完了まで release lane を block
- [ ] App Store sandbox での sidecar spawn 検証: App Sandbox が `posix_spawn` を許可するか、helper が `Bundle` を持つ必要がないか、`com.apple.security.app-sandbox` entitlement のみで spawn できるか
- [ ] helper の hardended runtime: `codesign --options=runtime` で hardened runtime を有効化、`com.apple.security.cs.*` entitlement の検証
- [ ] helper の App Group / container 共有が不要か (helper は sidecar で user-data を持たない前提なら不要)
- [ ] Foundation Models framework への dynamic link 確認 (`otool -L <helper>` で `FoundationModels.framework` が link されていること)
- [ ] swift `Package.swift` の `linkerFlags` 設定 (SwiftPM executable target は framework を自動 link する想定だが、`-rpath` / `@rpath/FoundationModels.framework` の path 確認)
- [ ] App Store guideline 2.4.2 (no unrelated background processes) と 2.4.5(i) (sandbox + private APIs) への適合確認
- [ ] `commands/apple_assist_supervisor.rs` の `#![allow(dead_code)]` を gate-flip 後に外し、production lib build で unused symbol warning が出ないことを確認
- [ ] `store_with_helper_path` / `store_without_helper` の `cfg(test)` gate が gate-flip 後も production 経路に混入しないことを再確認
- [ ] `cargo test apple_assist_supervisor` が packaged build の `current_exe().parent()` 配下の helper に対しても CI で再現できるよう、fixture env var の skip 動作を維持

## 参照

- `docs/apple-local-assist-rust-supervisor-plan.md` — supervisor 実装本体 (slice 8-18)
- `docs/apple-local-assist-live-helper-plan.md` — live mode 設計 / Swift 側
- `docs/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" / 全体方針
- `docs/apple-local-assist-v0.12-design-review.md` — gate-default-hidden 契約
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script (DEST 命名が production filename と一致)
- `src-tauri/src/commands/apple_assist_supervisor.rs` — supervisor 本体
