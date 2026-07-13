# Hazakura Local Assist — Bundled Helper Path 設計メモ

Status: Implemented on main (live helper gate flipped)
Scope: `src-tauri/src/commands/apple_assist_supervisor.rs` の `helper_path()` が production で bundled helper path を解決する現行設計。`bundle.externalBin` は追加済み。`minimumSystemVersion` / signing / entitlements / App Store sandbox は distribution-lane hardening として未決。
Authority: Medium
Last reviewed: 2026-06-06

## 目的

Rust supervisor は `binaries/hazakura-local-assist-helper-<rust-triple>` を build artifact として扱い、Tauri packaged build では `bundle.externalBin` により app bundle の `Contents/MacOS/` に helper を同梱する。現行 production `helper_path()` は `current_exe().parent()` 配下を探索し、Tauri が配置する base name (`hazakura-local-assist-helper`) と triple suffix name の両方を許容する。

## 結論

- **build artifact filename**: `binaries/hazakura-local-assist-helper-<rust-target-triple>` (例: `hazakura-local-assist-helper-aarch64-apple-darwin`)。fixture/live の build scripts はこの形へ出力する。
- **app bundle 内配置**: Tauri 2 packaged build では `Contents/MacOS/hazakura-local-assist-helper` として配置されることを `npm run build` で確認済み。Rust resolver は base name と triple suffix name の両方を探索する。
- **dev / test / packaged build の違い**:
  - **dev** (`npm run tauri dev`): `beforeDevCommand` は Vite のみ。production resolver は実行中バイナリ隣接 helper を探すため、dev で live helper を使うには helper を dev 実行バイナリの隣へ明示配置する必要がある。production `Default` は env var を読まない。
  - **test** (`cargo test --manifest-path src-tauri/Cargo.toml`): `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var で fixture binary path を渡し、`store_with_helper_path` 経由で supervisor に注入。production `Default` は env var を読まない (slice 14+ の回帰テストで固定)。
  - **packaged build** (DMG preview / App Store build / developer build): `bundle.externalBin` が `tauri.conf.json` に追加済み。`npm run build` は live helper を build し、Tauri が `Contents/MacOS/hazakura-local-assist-helper` として同梱・署名する。
- **missing helper 時の error message**: 現行 resolver は "Hazakura Local Assist helper is not configured for this build. Looked in <dir>." を返す。packaged build で `externalBin` を間違って外した / build artifact が壊れた場合は、この reason が UI に出る。
- **App Store sandbox / signing / notarization に入る前の確認項目**: 末尾の checklist は未完了。distribution lane へ進む前に別途確認する。

## 想定する production `helper_path()` の形

現行 resolver は次の流れ:

```rust
// 1. `rust_target_triple()` で host triple を返す (aarch64-apple-darwin / x86_64-apple-darwin)
// 2. `bundled_helper_filename()` で `hazakura-local-assist-helper-<triple>` を返す
// 3. `bundled_helper_base_filename()` で `hazakura-local-assist-helper` を返す
// 4. `resolve_bundled_helper_path()` は `current_exe().parent()` 配下で base/triple の両方を探索
//
// 呼び出し順:
//   helper_path() {
//     #[cfg(test)] { if helper_path_override: return ... }
//     resolve_bundled_helper_path()  // 現時点では not-configured を返す
//   }
```

`resolve_bundled_helper_path()` の現行形:

1. `std::env::current_exe()` で実行中バイナリのパスを取得。
2. `.parent()` を base にする (macOS app bundle の `Contents/MacOS/<main-binary>` から 1 つ上)。
3. base に `bundled_helper_filename()` と `bundled_helper_base_filename()` を連結。
4. いずれかが存在すれば `Ok(candidate)`。
5. 見つからなければ "not configured" reason を返す。

`current_exe()` 起点にする理由:

- Tauri 2 の `bundle.externalBin` は sidecar を `Contents/MacOS/<name>-<triple>` に配置する規約なので、`current_exe().parent()` から直線的にたどれる。
- `std::env::current_dir()` を使うと、launcher や terminal から起動されたときに CWD に依存してしまう。
- `$BUNDLE_RESOURCE_DIR` 系の Tauri API も候補だが、`externalBin` 経路では binary として配置されるため `current_exe()` ベースで十分。

## dev / test / packaged build の違い — 運用上のポイント

| 経路 | 用途 | helper の居場所 | production `helper_path()` の挙動 | テストの注入経路 |
|---|---|---|---|---|
| dev (`npm run tauri dev`) | 開発者の iteration | helper は自動配置されない | 実行バイナリ隣に helper がなければ `Err("not configured")` | `store_with_helper_path` で明示注入 |
| test (`cargo test`) | supervisor の integration test | `std::env::temp_dir()` の一時 shell script + `binaries/hazakura-local-assist-helper-<triple>` (env var 経由) | `Err("not configured")` | `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var + `store_with_helper_path` |
| packaged build (DMG preview) | ローカル動作確認 (ad-hoc signed) | Tauri が `Contents/MacOS/hazakura-local-assist-helper` に同梱 | `Ok(current_exe().parent() / filename)` | n/a (production 経路) |
| packaged build (developer build) | developer-signed 配布 | 同上 | 同上 | n/a |
| packaged build (App Store) | Mac App Store 提出 | 同上 + 公証 / signing | 同上 | n/a |

**現状**: packaged build は production helper path を使う。dev / test は helper 自動配置を前提にしない。

## Missing helper 時の error message 設計

production 経路で helper が見つからなかった場合の error メッセージは次の形にする:

- **現行 production 経路 (resolve_bundled_helper_path)**: `Err("Hazakura Local Assist helper is not configured for this build. Looked in <dir>.")`
  - `current_exe().parent()` の絶対パスを含める。
  - Rust 側の `spawn_locked` は helper 自体が missing なら spawn 前にこの `Err` で return する。

error メッセージの安定性:

- production 経路の文言は "file not found" 形式を保ち、OS error message (`os error 2` 等) を露出しない。理由は 2 つ: 1) エンドユーザー向けではないので技術詳細を控えめに、2) UI 側で reason 文字列を localized message にマップする余地を残す。
- "not configured" は slice 1-6 から pin してきた message で、UI 側 (`useAppleAssistAvailability` 等) が `reason.includes("not configured")` で分岐している可能性があるので、gate-flip 前は変えない。

## App Store sandbox / signing / notarization に入る前の確認項目

gate-flip 承認 (順序 14 相当) → `tauri.conf.json` の `bundle.externalBin` 追加 → App Store sandbox での sidecar spawn 検証、と進む前に確認すべき項目。**これらは本スライス (16) では着手せず、gate-flip 承認が降りたスライスのチェックリストとして残す。**

- [x] `tauri.conf.json` の `bundle.externalBin` に `../binaries/hazakura-local-assist-helper` を含める
- [ ] `minimumSystemVersion` の bump: Foundation Models は macOS 26+ SDK 必須なので、必要なら bump する (明示承認が必要)
- [ ] helper の Developer ID signing: ad-hoc ではなく Developer ID Application 証明書で署名
- [ ] helper の notarization: `notarytool` で `developer-id` profile に submit、公証完了まで release lane を block
- [ ] App Store sandbox での sidecar spawn 検証: App Sandbox が `posix_spawn` を許可するか、helper が `Bundle` を持つ必要がないか、`com.apple.security.app-sandbox` entitlement のみで spawn できるか
- [ ] helper の hardended runtime: `codesign --options=runtime` で hardened runtime を有効化、`com.apple.security.cs.*` entitlement の検証
- [ ] helper の App Group / container 共有が不要か (helper は sidecar で user-data を持たない前提なら不要)
- [ ] Foundation Models framework への dynamic link 確認 (`otool -L <helper>` で `FoundationModels.framework` が link されていること)
- [ ] swift `Package.swift` の `linkerFlags` 設定 (SwiftPM executable target は framework を自動 link する想定だが、`-rpath` / `@rpath/FoundationModels.framework` の path 確認)
- [ ] App Store guideline 2.4.2 (no unrelated background processes) と 2.4.5(i) (sandbox + private APIs) への適合確認
- [ ] `commands/apple_assist_supervisor.rs` の `#![allow(dead_code)]` を不要にできるか確認
- [ ] `store_with_helper_path` / `store_without_helper` の `cfg(test)` gate が gate-flip 後も production 経路に混入しないことを再確認
- [ ] `cargo test apple_assist_supervisor` が packaged build の `current_exe().parent()` 配下の helper に対しても CI で再現できるよう、fixture env var の skip 動作を維持

## 参照

- `docs/archive/planning/apple-local-assist-rust-supervisor-plan.md` — supervisor 実装本体 (slice 8-18)
- `docs/archive/planning/apple-local-assist-live-helper-plan.md` — live mode 設計 / Swift 側
- `docs/archive/planning/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" / 全体方針
- `docs/archive/reviews/apple-local-assist-v0.12-design-review.md` — gate-default-hidden 契約
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script (DEST 命名が production filename と一致)
- `src-tauri/src/commands/apple_assist_supervisor.rs` — supervisor 本体
