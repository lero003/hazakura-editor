# Third-Party Notices

Status: Draft
Scope: hazakura editor dependency, bundled-helper, and asset provenance notes
Authority: Medium
Last reviewed: 2026-06-12

This file is a distribution-prep draft, not legal advice. Before a public App
Store, Developer ID, or commercial binary distribution, refresh the dependency
scan from the committed lockfiles, preserve required upstream notices, and
have the final package reviewed.

## License Position

hazakura editor itself is source-available proprietary software:

```text
Copyright (c) 2026 Hazakura Lab. All rights reserved.
```

The app is intentionally shipped with open source acknowledgements. Third-party
components remain licensed by their own authors and rights holders. The
project's intended posture is:

- App body: source-available proprietary license / all rights reserved except for the permissions granted in `LICENSE`.
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
- 2026-06-12 refresh:
  - `package-lock.json` runtime dependency names were compared against this
    file; no missing runtime JavaScript entries were found.
  - `cargo metadata --manifest-path src-tauri/Cargo.toml --locked
    --format-version 1` was compared against this file; additional resolved
    Cargo graph entries were added in the appendix below.

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

### 2026-06-12 Resolved Cargo Graph Appendix

The following entries were present in the resolved Cargo graph but were not
previously named explicitly in this file. They are grouped by the license value
reported by `cargo metadata --locked`.

| License | Additional resolved components |
| --- | --- |
| `Apache-2.0 OR MIT` | `bit-set@0.8.0`, `bit-vec@0.8.0`, `ctor-proc-macro@0.0.7`, `ctor@0.8.0`, `dtor-proc-macro@0.0.6`, `dtor@0.3.0`, `fastrand@2.4.1`, `idna_adapter@1.2.2`, `indexmap@1.9.3`, `libappindicator-sys@0.9.0`, `libappindicator@0.9.0`, `rustc-hash@2.1.2`, `utf8_iter@1.0.4`, `window-vibrancy@0.6.0` |
| `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` | `wasip3@0.4.0+wasi-0.3.0-rc-2026-01-06`, `wit-bindgen-core@0.51.0`, `wit-bindgen-rust-macro@0.51.0`, `wit-bindgen-rust@0.51.0`, `wit-bindgen@0.51.0` |
| `Apache-2.0/MIT` | `cesu8@1.1.0`, `dbus@0.9.11`, `libdbus-sys@0.2.7` |
| `MIT` | `cairo-sys-rs@0.18.2`, `darling_core@0.23.0`, `darling_macro@0.23.0`, `derive_more-impl@2.1.1`, `dlopen2@0.8.2`, `dlopen2_derive@0.4.3`, `gdk-pixbuf-sys@0.18.0`, `gdk-pixbuf@0.18.5`, `gdk-sys@0.18.2`, `gdkwayland-sys@0.18.2`, `gdkx11-sys@0.18.2`, `gdkx11@0.18.2`, `generic-array@0.14.7`, `gio-sys@0.18.1`, `glib-macros@0.18.5`, `glib-sys@0.18.1`, `gobject-sys@0.18.0`, `gtk-sys@0.18.2`, `gtk3-macros@0.18.2`, `http-body-util@0.1.3`, `http-body@1.0.1`, `hyper-util@0.1.20`, `javascriptcore-rs-sys@1.1.1`, `libredox@0.1.16`, `new_debug_unreachable@1.0.6`, `objc2-encode@4.1.0`, `pango-sys@0.18.0`, `phf_codegen@0.13.1`, `phf_generator@0.13.1`, `phf_macros@0.13.1`, `phf_shared@0.13.1`, `precomputed-hash@0.1.1`, `redox_syscall@0.5.18`, `redox_users@0.5.2`, `schemars@0.8.22`, `schemars@0.9.0`, `schemars_derive@0.8.22`, `simd-adler32@0.3.9`, `soup3-sys@0.5.0`, `synstructure@0.13.2`, `tokio-util@0.7.18`, `tower-http@0.6.11`, `tower-layer@0.3.3`, `tower-service@0.3.3`, `tracing-core@0.1.36`, `try-lock@0.2.5`, `version-compare@0.2.1`, `vswhom-sys@0.1.3`, `vswhom@0.1.0`, `want@0.3.1`, `webkit2gtk-sys@2.0.2`, `webview2-com-macros@0.8.1`, `webview2-com-sys@0.38.2`, `winnow@0.5.40`, `winnow@0.7.15` |
| `MIT OR Apache-2.0` | `block-buffer@0.10.4`, `cargo-platform@0.1.9`, `cfg-expr@0.15.8`, `core-graphics-types@0.2.0`, `cpufeatures@0.2.17`, `crossbeam-channel@0.5.15`, `crossbeam-utils@0.8.21`, `crypto-common@0.1.7`, `deranged@0.5.8`, `digest@0.10.7`, `dirs-sys@0.5.0`, `displaydoc@0.2.5`, `dtoa@1.0.11`, `dyn-clone@1.0.20`, `embed_plist@1.2.2`, `erased-serde@0.4.10`, `fdeflate@0.3.7`, `field-offset@0.3.6`, `find-msvc-tools@0.1.9`, `form_urlencoded@1.2.2`, `futures-channel@0.3.32`, `futures-executor@0.3.32`, `futures-io@0.3.32`, `futures-macro@0.3.32`, `futures-sink@0.3.32`, `futures-task@0.3.32`, `getrandom@0.4.2`, `glob@0.3.3`, `hashbrown@0.12.3`, `hashbrown@0.15.5`, `heck@0.4.1`, `heck@0.5.0`, `hex@0.4.3`, `html5ever@0.38.0`, `httparse@1.10.1`, `iana-time-zone-haiku@0.1.2`, `iana-time-zone@0.1.65`, `ipnet@2.12.0`, `jni-sys-macros@0.4.1`, `jni-sys@0.3.1`, `jni-sys@0.4.1`, `js-sys@0.3.99`, `jsonptr@0.6.3`, `keyboard-types@0.7.0`, `leb128fmt@0.1.0`, `lock_api@0.4.14`, `markup5ever@0.38.0`, `mime@0.3.17`, `ndk-sys@0.6.0+11769913`, `ndk@0.9.0`, `num-conv@0.2.2`, `num-traits@0.2.19`, `parking_lot_core@0.9.12`, `pkg-config@0.3.33`, `png@0.17.16`, `powerfmt@0.2.0`, `prettyplease@0.2.37`, `proc-macro-crate@1.3.1`, `proc-macro-crate@2.0.2`, `proc-macro-crate@3.5.0`, `proc-macro-error-attr@1.0.4`, `proc-macro-error@1.0.4`, `ref-cast-impl@1.0.25`, `ref-cast@1.0.25`, `regex-automata@0.4.14`, `regex-syntax@0.8.10`, `rustc_version@0.4.1`, `rustversion@1.0.22`, `scopeguard@1.2.0`, `serde-untagged@0.1.9`, `serde_core@1.0.228`, `serde_derive@1.0.228`, `serde_derive_internals@0.29.1`, `serde_repr@0.1.20`, `serde_spanned@0.6.9`, `serde_spanned@1.1.1`, `serde_with@3.20.0`, `serde_with_macros@3.20.0`, `serialize-to-javascript-impl@0.1.2`, `serialize-to-javascript@0.1.2`, `servo_arc@0.4.3`, `shlex@1.3.0`, `socket2@0.6.3`, `softbuffer@0.4.8`, `stable_deref_trait@1.2.1`, `string_cache@0.9.0`, `string_cache_codegen@0.6.1`, `syn@1.0.109`, `system-deps@6.2.2`, `tao-macros@0.1.3`, `tendril@0.5.0`, `thiserror-impl@1.0.69`, `thiserror-impl@2.0.18`, `thiserror@1.0.69`, `time-core@0.1.8`, `time-macros@0.2.27`, `toml@0.8.2`, `toml@0.9.12+spec-1.1.0`, `toml_datetime@0.6.3`, `toml_datetime@0.7.5+spec-1.1.0`, `toml_datetime@1.1.1+spec-1.1.0`, `toml_edit@0.19.15`, `toml_edit@0.20.2`, `toml_edit@0.25.11+spec-1.1.0`, `toml_parser@1.1.2+spec-1.1.0`, `toml_writer@1.1.1+spec-1.1.0`, `tray-icon@0.23.1`, `typeid@1.0.3`, `typenum@1.20.0`, `unicode-segmentation@1.13.2`, `unicode-xid@0.2.6`, `utf-8@0.7.6`, `wasm-bindgen-futures@0.4.72`, `wasm-bindgen-macro-support@0.2.122`, `wasm-bindgen-macro@0.2.122`, `wasm-bindgen-shared@0.2.122`, `wasm-streams@0.5.0`, `web_atoms@0.2.4`, `windows-collections@0.2.0`, `windows-core@0.61.2`, `windows-core@0.62.2`, `windows-future@0.2.1`, `windows-implement@0.60.2`, `windows-interface@0.59.3`, `windows-link@0.1.3`, `windows-link@0.2.1`, `windows-numerics@0.2.0`, `windows-result@0.3.4`, `windows-result@0.4.1`, `windows-strings@0.4.2`, `windows-strings@0.5.1`, `windows-sys@0.45.0`, `windows-sys@0.59.0`, `windows-sys@0.60.2`, `windows-sys@0.61.2`, `windows-targets@0.42.2`, `windows-targets@0.52.6`, `windows-targets@0.53.5`, `windows-threading@0.1.0`, `windows-version@0.1.7`, `windows_aarch64_gnullvm@0.42.2`, `windows_aarch64_gnullvm@0.52.6`, `windows_aarch64_gnullvm@0.53.1`, `windows_aarch64_msvc@0.42.2`, `windows_aarch64_msvc@0.52.6`, `windows_aarch64_msvc@0.53.1`, `windows_i686_gnu@0.42.2`, `windows_i686_gnu@0.52.6`, `windows_i686_gnu@0.53.1`, `windows_i686_gnullvm@0.52.6`, `windows_i686_gnullvm@0.53.1`, `windows_i686_msvc@0.42.2`, `windows_i686_msvc@0.52.6`, `windows_i686_msvc@0.53.1`, `windows_x86_64_gnu@0.42.2`, `windows_x86_64_gnu@0.52.6`, `windows_x86_64_gnu@0.53.1`, `windows_x86_64_gnullvm@0.42.2`, `windows_x86_64_gnullvm@0.52.6`, `windows_x86_64_gnullvm@0.53.1`, `windows_x86_64_msvc@0.42.2`, `windows_x86_64_msvc@0.52.6`, `windows_x86_64_msvc@0.53.1` |
| `MIT OR Apache-2.0 OR Zlib` | `raw-window-handle@0.6.2`, `tinyvec_macros@0.1.1` |
| `MIT OR Zlib OR Apache-2.0` | `miniz_oxide@0.8.9` |
| `MIT/Apache-2.0` | `bs58@0.5.1`, `foreign-types-macros@0.2.3`, `foreign-types-shared@0.3.1`, `foreign-types@0.5.0`, `id-arena@2.3.0`, `ident_case@1.0.1`, `siphasher@1.0.3`, `unic-char-property@0.9.0`, `unic-char-range@0.9.0`, `unic-common@0.9.0`, `unic-ucd-ident@0.9.0`, `unic-ucd-version@0.9.0`, `winapi-i686-pc-windows-gnu@0.4.0`, `winapi-x86_64-pc-windows-gnu@0.4.0` |
| `Unicode-3.0` | `icu_normalizer_data@2.2.0`, `icu_properties_data@2.2.0`, `potential_utf@0.1.5`, `yoke-derive@0.8.2`, `zerofrom-derive@0.1.7`, `zerovec-derive@0.11.3` |
| `Zlib OR Apache-2.0 OR MIT` | `objc2-cloud-kit@0.3.2`, `objc2-core-data@0.3.2`, `objc2-core-image@0.3.2`, `objc2-core-location@0.3.2`, `objc2-core-text@0.3.2`, `objc2-exception-helper@0.1.1`, `objc2-io-surface@0.3.2`, `objc2-quartz-core@0.3.2`, `objc2-ui-kit@0.3.2`, `objc2-user-notifications@0.3.2` |

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

### `hazakura-local-assist-helper`

Known repository provenance:

- Source package: `src-helpers/apple-assist`.
- Swift package target: `HazakuraAppleAssist`.
- Build script: `scripts/build-apple-assist-helper-live.sh`.
- Output artifact pattern:
  `binaries/hazakura-local-assist-helper-<rust-target-triple>`.
- Tauri bundle config: `bundle.externalBin` includes
  `../binaries/hazakura-local-assist-helper`, which packages the helper as
  `Contents/MacOS/hazakura-local-assist-helper`.
- The live helper links Apple `FoundationModels.framework` and communicates
  with the Tauri/Rust app over JSON lines on stdio.

Distribution note: treat the helper as Hazakura Lab-authored proprietary
sidecar source and binary. It also uses Apple platform frameworks and SDKs,
whose availability and distribution constraints must be handled through the
app's Apple distribution lane, not as an OSS dependency.

## Final Distribution Checklist

- Refresh `package-lock.json` and `src-tauri/Cargo.lock` license scans before
  each submission package. Latest tracked refresh: 2026-06-12.
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
