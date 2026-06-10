# Third-Party Notices

Status: Draft
Scope: hazakura editor dependency, bundled-helper, and asset provenance notes
Authority: Medium
Last reviewed: 2026-06-10

This file is a distribution-prep draft, not legal advice. Before a public App
Store, Developer ID, or commercial binary distribution, refresh the dependency
scan from the committed lockfiles, preserve required upstream notices, and
have the final package reviewed.

## License Position

hazakura editor itself is proprietary software:

```text
Copyright (c) 2026 Hazakura Lab. All rights reserved.
```

The app is intentionally shipped with open source acknowledgements. Third-party
components remain licensed by their own authors and rights holders. The
project's intended posture is:

- App body: proprietary commercial license / all rights reserved.
- Dependency posture: open source attribution and notice preservation.
- Distribution artifact: include this notice file or an equivalent in-app /
  package notice surface.

In plain language: hazakura editor is Hazakura Lab software, built on the
shoulders of open source software.

## Sources Used For This Draft

- `package.json` and `package-lock.json`
- `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`
- `cargo metadata --manifest-path src-tauri/Cargo.toml --locked`
- `node_modules/dompurify/LICENSE` and `node_modules/dompurify/LICENSE-MPL`
- `encoding_rs` crate `COPYRIGHT`, `LICENSE-APACHE`, `LICENSE-MIT`, and
  `LICENSE-WHATWG`
- `src-helpers/apple-assist/Package.swift`
- `scripts/build-apple-assist-helper-live.sh`
- `src-tauri/tauri.conf.json`
- Current project docs for app icon and helper build provenance

## Important Policy Notes

### DOMPurify

`dompurify@3.4.8` declares `(MPL-2.0 OR Apache-2.0)`.

Project policy: treat DOMPurify under the Apache-2.0 option for hazakura
editor distribution notices, unless a future legal review explicitly chooses a
different option. Keep the upstream Apache-2.0 license text available with the
distributed notice set.

### encoding_rs

`encoding_rs@0.8.35` declares `(Apache-2.0 OR MIT) AND BSD-3-Clause`.

Do not collapse this into only MIT / Apache-2.0. The crate includes data
derived from WHATWG Encoding Standard data files. For distribution, preserve
the BSD-3-Clause notice for the incorporated WHATWG data, including the
WHATWG copyright holder attribution and disclaimer from `encoding_rs`'
`LICENSE-WHATWG`.

Practical rule: if hazakura editor ships `encoding_rs`, the notice bundle must
carry both the chosen Apache-2.0 or MIT side for the crate code and the
BSD-3-Clause WHATWG-data notice.

## Runtime JavaScript Dependencies

Derived from `package-lock.json`, excluding packages marked dev-only.

| Component | License |
| --- | --- |
| `dompurify@3.4.8` | `(MPL-2.0 OR Apache-2.0)`; project policy chooses Apache-2.0 |
| `@tauri-apps/api@2.11.0` | `Apache-2.0 OR MIT` |
| `@tauri-apps/plugin-dialog@2.7.1` | `MIT OR Apache-2.0` |
| `@codemirror/autocomplete@6.20.3` | `MIT` |
| `@codemirror/commands@6.10.3` | `MIT` |
| `@codemirror/lang-css@6.3.1` | `MIT` |
| `@codemirror/lang-html@6.4.11` | `MIT` |
| `@codemirror/lang-javascript@6.2.5` | `MIT` |
| `@codemirror/lang-markdown@6.5.0` | `MIT` |
| `@codemirror/language@6.12.3` | `MIT` |
| `@codemirror/lint@6.9.6` | `MIT` |
| `@codemirror/search@6.7.0` | `MIT` |
| `@codemirror/state@6.6.0` | `MIT` |
| `@codemirror/view@6.43.0` | `MIT` |
| `@lezer/common@1.5.2` | `MIT` |
| `@lezer/css@1.3.3` | `MIT` |
| `@lezer/highlight@1.2.3` | `MIT` |
| `@lezer/html@1.3.13` | `MIT` |
| `@lezer/javascript@1.5.4` | `MIT` |
| `@lezer/lr@1.4.10` | `MIT` |
| `@lezer/markdown@1.6.4` | `MIT` |
| `@marijn/find-cluster-break@1.0.2` | `MIT` |
| `@types/trusted-types@2.0.7` | `MIT` |
| `@xterm/addon-fit@0.11.0` | `MIT` |
| `@xterm/xterm@6.0.0` | `MIT` |
| `codemirror@6.0.2` | `MIT` |
| `crelt@1.0.6` | `MIT` |
| `marked@18.0.5` | `MIT` |
| `react@19.2.7` | `MIT` |
| `react-dom@19.2.7` | `MIT` |
| `scheduler@0.27.0` | `MIT` |
| `style-mod@4.1.3` | `MIT` |
| `w3c-keyname@2.2.8` | `MIT` |

## Rust / Tauri Dependency License Families

Derived from `cargo metadata --manifest-path src-tauri/Cargo.toml --locked`.
This list is conservative: it includes the resolved Cargo graph and may include
platform-specific crates that are not linked into a particular macOS build.

### MIT / Apache-2.0 Family

- `adler2@2.0.1` (`0BSD OR MIT OR Apache-2.0`)
- `anyhow@1.0.102`, `base64@0.21.7`, `base64@0.22.1`,
  `bitflags@2.11.1`, `bumpalo@3.20.3`, `camino@1.2.2`, `cc@1.2.62`,
  `cfg-if@1.0.4`, `chrono@0.4.44`, `cookie@0.18.1`,
  `core-foundation@0.10.1`, `core-foundation-sys@0.8.7`,
  `core-graphics@0.25.0`, `crc32fast@1.5.0`, `dirs@6.0.0`,
  `flate2@1.1.9`, `futures-core@0.3.32`, `futures-util@0.3.32`,
  `getrandom@0.2.17`, `getrandom@0.3.4`, `hashbrown@0.17.1`,
  `http@1.4.1`, `idna@1.1.0`, `itoa@1.0.18`, `libc@0.2.186`,
  `log@0.4.30`, `mio@1.2.0`, `once_cell@1.21.4`,
  `parking_lot@0.12.5`, `percent-encoding@2.3.2`, `png@0.18.1`,
  `proc-macro2@1.0.106`, `quote@1.0.45`, `regex@1.12.3`,
  `reqwest@0.13.4`, `semver@1.0.28`, `serde@1.0.228`,
  `serde_json@1.0.150`, `sha2@0.10.9`, `smallvec@1.15.1`,
  `swift-rs@1.0.7`, `syn@2.0.117`, `tauri@2.11.2`,
  `thiserror@2.0.18`, `time@0.3.47`, `tokio@1.52.3`,
  `toml@1.1.2+spec-1.1.0`, `url@2.5.8`, `uuid@1.23.1`,
  `wasm-bindgen@0.2.122`, `web-sys@0.3.99`, `windows@0.61.3`
  and related Windows target crates (`MIT OR Apache-2.0`)
- `atomic-waker@1.1.2`, `autocfg@1.5.1`, `cargo_toml@0.22.3`,
  `equivalent@1.0.2`, `indexmap@2.14.0`, `muda@0.19.2`,
  `pin-project-lite@0.2.17`, `tauri-build@2.6.2`,
  `tauri-codegen@2.6.2`, `tauri-macros@2.6.2`,
  `tauri-plugin@2.6.2`, `tauri-plugin-dialog@2.7.1`,
  `tauri-plugin-fs@2.5.1`, `tauri-runtime@2.11.2`,
  `tauri-runtime-wry@2.11.2`, `tauri-utils@2.9.2`, `wry@0.55.1`
  (`Apache-2.0 OR MIT`)
- `android_system_properties@0.1.5`, `bitflags@1.3.2`, `jni@0.21.1`,
  `json-patch@3.0.1`, `version_check@0.9.5`, `winapi@0.3.9`
  (`MIT/Apache-2.0`)
- `dpi@0.1.2` (`Apache-2.0 AND MIT`)
- `fnv@1.0.7` (`Apache-2.0 / MIT`)

### MIT Family

- `atk@0.18.2`, `atk-sys@0.18.2`, `block2@0.6.2`, `bytes@1.11.1`,
  `cairo-rs@0.18.5`, `cargo_metadata@0.19.2`, `cfb@0.7.3`,
  `combine@4.6.7`, `darling@0.23.0`, `derive_more@2.1.1`,
  `dom_query@0.27.0`, `embed-resource@3.0.9`, `gdk@0.18.2`,
  `gio@0.18.4`, `glib@0.18.5`, `gtk@0.18.2`, `hyper@1.9.0`,
  `ico@0.5.0`, `infer@0.19.0`, `javascriptcore-rs@1.1.2`,
  `memoffset@0.9.1`, `objc2@0.6.4`, `objc2-foundation@0.3.2`,
  `pango@0.18.3`, `phf@0.13.1`, `plist@1.9.0`,
  `quick-xml@0.39.4`, `rfd@0.16.0`, `schemars@1.2.1`,
  `slab@0.4.12`, `soup3@0.5.0`, `strsim@0.11.1`,
  `tauri-winres@0.3.6`, `tower@0.5.3`, `tracing@0.1.44`,
  `urlpattern@0.3.0`, `webkit2gtk@2.0.2`, `webview2-com@0.38.2`,
  `winreg@0.55.0`, `winnow@1.0.3`, `x11@2.21.0`, `x11-dl@2.21.0`,
  `zmij@1.0.21` and related GTK / WebKit / derive support crates (`MIT`)
- `aho-corasick@1.1.4`, `byteorder@1.5.0`, `memchr@2.8.0`,
  `winapi-util@0.1.11` (`Unlicense OR MIT`)
- `same-file@1.0.6`, `walkdir@2.5.0` (`Unlicense/MIT`)

### Apache-2.0 Family

- `sync_wrapper@1.0.2`, `tao@0.35.3` (`Apache-2.0`)
- `target-lexicon@0.12.16` (`Apache-2.0 WITH LLVM-exception`)
- WASI / WIT crates such as `wasi@0.11.1+wasi-snapshot-preview1`,
  `wasip2@1.0.3+wasi-0.2.9`, `wasm-encoder@0.244.0`,
  `wasm-metadata@0.244.0`, `wasmparser@0.244.0`,
  `wit-bindgen@0.57.1`, `wit-component@0.244.0`, and
  `wit-parser@0.244.0`
  (`Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT`)

### BSD Family

- `encoding_rs@0.8.35` (`(Apache-2.0 OR MIT) AND BSD-3-Clause`);
  preserve the WHATWG BSD-3-Clause notice described above.
- `alloc-no-stdlib@2.0.4`, `alloc-stdlib@0.2.2` (`BSD-3-Clause`)
- `brotli@8.0.2` (`BSD-3-Clause AND MIT`)
- `brotli-decompressor@5.0.0` (`BSD-3-Clause/MIT`)
- `num_enum@0.7.6`, `num_enum_derive@0.7.6`
  (`BSD-3-Clause OR MIT OR Apache-2.0`)

### MPL-2.0 Family

- `cssparser@0.36.0`, `cssparser-macros@0.6.1`, `dtoa-short@0.3.5`,
  `option-ext@0.2.0`, `selectors@0.36.1` (`MPL-2.0`)

### CC0 / Unicode / Zlib / ISC / LGPL-Option Family

- `dunce@1.0.5` (`CC0-1.0 OR MIT-0 OR Apache-2.0`)
- ICU / Unicode crates such as `icu_collections@2.2.0`,
  `icu_locale_core@2.2.0`, `icu_normalizer@2.2.0`,
  `icu_properties@2.2.0`, `icu_provider@2.2.0`, `litemap@0.8.2`,
  `tinystr@0.8.3`, `writeable@0.6.3`, `yoke@0.8.2`,
  `zerofrom@0.1.8`, `zerotrie@0.2.4`, `zerovec@0.11.6`
  (`Unicode-3.0`)
- `unicode-ident@1.0.24` (`(MIT OR Apache-2.0) AND Unicode-3.0`)
- `libloading@0.7.4` (`ISC`)
- `foldhash@0.1.5`, `foldhash@0.2.0` (`Zlib`)
- `bytemuck@1.25.0`, `dispatch2@0.3.1`, `objc2-app-kit@0.3.2`,
  `objc2-core-foundation@0.3.2`, `objc2-core-graphics@0.3.2`,
  `objc2-web-kit@0.3.2`, `tinyvec@1.11.0`
  (`Zlib OR Apache-2.0 OR MIT`)
- `r-efi@5.3.0`, `r-efi@6.0.0`
  (`MIT OR Apache-2.0 OR LGPL-2.1-or-later`)

## Development / Build Tool Licenses To Keep Visible

These packages are marked dev-only in `package-lock.json`, so they may not be
part of the shipped runtime bundle. They still matter for source repository,
build, audit, and attribution review.

| License | Components |
| --- | --- |
| `BlueOak-1.0.0` | `lru-cache@11.5.1` |
| `CC0-1.0` | `mdn-data@2.27.1` |
| `BSD-2-Clause` | `entities@8.0.0`, `webidl-conversions@8.0.1` |
| `BSD-3-Clause` | `source-map-js@1.2.1`, `tough-cookie@6.0.1` |
| `MPL-2.0` | `lightningcss@1.32.0` and platform packages |
| `Apache-2.0` | `aria-query@5.3.0`, `detect-libc@2.1.2`, `expect-type@1.3.0`, `typescript@6.0.3`, `xml-name-validator@5.0.0` |
| `0BSD` | `tslib@2.8.1` |
| `MIT-0` | `@csstools/color-helpers@6.0.2`, `@csstools/css-syntax-patches-for-csstree@1.1.5` |
| `ISC` | `picocolors@1.1.1`, `saxes@6.0.0`, `siginfo@2.0.0` |

## Asset And Helper Provenance

### `src-tauri/icons/icon.icns`

Known repository provenance:

- Current Tauri bundle config points to `src-tauri/icons/icon.icns`.
- The current app icon, `src-tauri/icons/icon.png`,
  `src/assets/hazakura-mark.png`, and `public/favicon.png` are project assets.
- Current docs describe the app / README logo as the transparent hazakura
  flower-and-leaf mark and note that `src-tauri/icons/icon.icns` was
  regenerated during v0.16 release-prep alignment.

Distribution note: treat the icon and logo assets as Hazakura Lab proprietary
brand assets unless a later provenance review identifies an external source.
Before App Store submission or broader commercial distribution, record the
original design source file / generator / artist attribution if it exists
outside this repository.

### `hazakura-apple-assist-helper`

Known repository provenance:

- Source package: `src-helpers/apple-assist`.
- Swift package target: `HazakuraAppleAssist`.
- Build script: `scripts/build-apple-assist-helper-live.sh`.
- Output artifact pattern:
  `binaries/hazakura-apple-assist-helper-<rust-target-triple>`.
- Tauri bundle config: `bundle.externalBin` includes
  `../binaries/hazakura-apple-assist-helper`, which packages the helper as
  `Contents/MacOS/hazakura-apple-assist-helper`.
- The live helper links Apple `FoundationModels.framework` and communicates
  with the Tauri/Rust app over JSON lines on stdio.

Distribution note: treat the helper as Hazakura Lab-authored proprietary
sidecar source and binary. It also uses Apple platform frameworks and SDKs,
whose availability and distribution constraints must be handled through the
app's Apple distribution lane, not as an OSS dependency.

## Final Distribution Checklist

- Refresh `package-lock.json` and `src-tauri/Cargo.lock` license scans.
- Confirm which dependencies are actually bundled in App Store and Developer /
  GitHub builds.
- Preserve DOMPurify under the Apache-2.0 notice option or record a deliberate
  policy change.
- Preserve the `encoding_rs` BSD-3-Clause WHATWG-data notice.
- Include full license texts or upstream notice files for MIT, Apache-2.0,
  BSD-2-Clause, BSD-3-Clause, MPL-2.0, CC0-1.0, BlueOak-1.0.0, 0BSD,
  MIT-0, ISC, Unicode-3.0, Unlicense, Zlib, and any LGPL-option component
  that remains in the distributed dependency graph.
- Confirm icon/logo source provenance.
- Confirm whether the shipped app exposes this notice in the app bundle,
  release assets, in-app About surface, or all of the above.
