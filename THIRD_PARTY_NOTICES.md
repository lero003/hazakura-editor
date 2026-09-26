# Third-Party Notices

Status: Draft
Scope: hazakura editor dependency, bundled-helper, and asset provenance notes
Authority: Medium
Last reviewed: 2026-09-25

This file is a distribution-prep draft, not legal advice. The dependency
inventory below reflects the v3.2.0 candidate lockfiles. Before submitting
the final App Store or Developer ID package, preserve required upstream
license texts and notices and review the exact signed package.

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
  with each macOS target passed to `--filter-platform`
- `node_modules/dompurify/LICENSE` and `node_modules/dompurify/LICENSE-MPL`
- `encoding_rs` crate `COPYRIGHT`, `LICENSE-APACHE`, `LICENSE-MIT`, and
  `LICENSE-WHATWG`
- `src-helpers/apple-assist/Package.swift`
- `src-helpers/apple-assist/CoreAI.Package.resolved`
- `src-helpers/apple-assist/CoreAIProduction.Package.resolved`
- `scripts/build-apple-assist-helper-live.sh`
- `src-tauri/tauri.conf.json`
- Current project docs for app icon and helper build provenance
- 2026-09-25 refresh:
  - Runtime JavaScript names, versions, and license expressions were read from
    the v3.2.0 `package-lock.json`.
  - Cargo names, versions, and license expressions were read from locked
    `cargo metadata` for both `aarch64-apple-darwin` and
    `x86_64-apple-darwin`; the union is listed below.
  - Core AI Swift package pins remain unchanged; their license-text review is
    a separate final-package gate.

## Important Policy Notes

### DOMPurify

`dompurify@3.4.16` declares `(MPL-2.0 OR Apache-2.0)`.

Project policy: treat DOMPurify under the Apache-2.0 option for hazakura
editor distribution notices, unless a future legal review explicitly chooses a
different option. Keep the upstream Apache-2.0 license text available with the
distributed notice set.

### encoding_rs

`encoding_rs@0.8.42` declares `(Apache-2.0 OR MIT) AND BSD-3-Clause`.

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
| `@codemirror/autocomplete@6.20.3` | `MIT` |
| `@codemirror/commands@6.10.4` | `MIT` |
| `@codemirror/lang-css@6.3.1` | `MIT` |
| `@codemirror/lang-html@6.4.12` | `MIT` |
| `@codemirror/lang-javascript@6.2.5` | `MIT` |
| `@codemirror/lang-markdown@6.5.2` | `MIT` |
| `@codemirror/language@6.12.4` | `MIT` |
| `@codemirror/lint@6.9.7` | `MIT` |
| `@codemirror/search@6.7.1` | `MIT` |
| `@codemirror/state@6.7.0` | `MIT` |
| `@codemirror/view@6.43.13` | `MIT` |
| `@lezer/common@1.5.2` | `MIT` |
| `@lezer/css@1.3.4` | `MIT` |
| `@lezer/highlight@1.2.3` | `MIT` |
| `@lezer/html@1.3.13` | `MIT` |
| `@lezer/javascript@1.5.4` | `MIT` |
| `@lezer/lr@1.4.10` | `MIT` |
| `@lezer/markdown@1.6.4` | `MIT` |
| `@marijn/find-cluster-break@1.0.3` | `MIT` |
| `@tauri-apps/api@2.11.1` | `Apache-2.0 OR MIT` |
| `@tauri-apps/plugin-dialog@2.7.3` | `MIT OR Apache-2.0` |
| `@types/trusted-types@2.0.7` | `MIT` |
| `@xterm/addon-fit@0.11.0` | `MIT` |
| `@xterm/xterm@6.0.0` | `MIT` |
| `codemirror@6.0.2` | `MIT` |
| `crelt@1.0.7` | `MIT` |
| `dompurify@3.4.16` | `(MPL-2.0 OR Apache-2.0); project policy chooses Apache-2.0` |
| `marked@18.0.14` | `MIT` |
| `react@19.3.0` | `MIT` |
| `react-dom@19.3.0` | `MIT` |
| `scheduler@0.28.0` | `MIT` |
| `style-mod@4.1.3` | `MIT` |
| `w3c-keyname@2.2.8` | `MIT` |
| `yaml@2.9.1` | `ISC` |

### yaml (ISC)

`yaml@2.9.1` is a direct runtime dependency used by OKF frontmatter parsing.
Preserve the ISC copyright and permission notice from `node_modules/yaml/LICENSE`
(Copyright Eemeli Aro) with the distributed notice set.

## Rust / Tauri Dependency License Inventory

Derived from locked `cargo metadata` for macOS Apple Silicon and Intel targets.
The list includes the union of resolved runtime and build dependencies, so it
is conservative: being listed does not establish that a crate is linked into
a particular binary. The committed `Cargo.lock` is the complete version
source for all targets. License expressions are retained as reported by the
resolved crates rather than collapsed into a single family.

| License expression | Resolved crates |
| --- | ---: |
| `(Apache-2.0 OR MIT) AND BSD-3-Clause` | 1 |
| `(MIT OR Apache-2.0) AND Unicode-3.0` | 1 |
| `0BSD OR MIT OR Apache-2.0` | 1 |
| `Apache-2.0` | 1 |
| `Apache-2.0 / MIT` | 1 |
| `Apache-2.0 AND ISC` | 1 |
| `Apache-2.0 AND MIT` | 1 |
| `Apache-2.0 OR ISC OR MIT` | 1 |
| `Apache-2.0 OR MIT` | 33 |
| `Apache-2.0/MIT` | 1 |
| `BSD-3-Clause` | 3 |
| `BSD-3-Clause AND MIT` | 1 |
| `BSD-3-Clause/MIT` | 1 |
| `CC0-1.0 OR MIT-0 OR Apache-2.0` | 1 |
| `CDLA-Permissive-2.0` | 1 |
| `ISC` | 2 |
| `MIT` | 48 |
| `MIT / Apache-2.0` | 1 |
| `MIT OR Apache-2.0` | 142 |
| `MIT OR Apache-2.0 OR Zlib` | 1 |
| `MIT OR Zlib OR Apache-2.0` | 2 |
| `MIT/Apache-2.0` | 17 |
| `MPL-2.0` | 5 |
| `Unicode-3.0` | 18 |
| `Unlicense OR MIT` | 5 |
| `Unlicense/MIT` | 2 |
| `Zlib` | 2 |
| `Zlib OR Apache-2.0 OR MIT` | 9 |

### `(Apache-2.0 OR MIT) AND BSD-3-Clause` (1)

- `encoding_rs@0.8.42`

### `(MIT OR Apache-2.0) AND Unicode-3.0` (1)

- `unicode-ident@1.0.26`

### `0BSD OR MIT OR Apache-2.0` (1)

- `adler2@2.0.1`

### `Apache-2.0` (1)

- `tao@0.35.3`

### `Apache-2.0 / MIT` (1)

- `fnv@1.0.7`

### `Apache-2.0 AND ISC` (1)

- `ring@0.17.14`

### `Apache-2.0 AND MIT` (1)

- `dpi@0.1.2`

### `Apache-2.0 OR ISC OR MIT` (1)

- `rustls@0.23.45`

### `Apache-2.0 OR MIT` (33)

- `autocfg@1.5.1`, `bit-set@0.8.0`, `bit-vec@0.8.0`, `cargo_toml@0.22.3`, `ctor-proc-macro@0.0.7`,
  `ctor@0.8.0`, `dtor-proc-macro@0.0.6`, `dtor@0.3.0`, `equivalent@1.0.2`, `fastrand@2.5.0`,
  `idna_adapter@1.2.2`, `indexmap@1.9.3`, `indexmap@2.14.2`, `muda@0.19.3`,
  `multiversion_no_op@1.0.0`, `pin-project-lite@0.2.17`, `rustc-hash@2.1.3`, `tauri-build@2.6.3`,
  `tauri-codegen@2.6.3`, `tauri-macros@2.6.3`, `tauri-plugin-dialog@2.7.3`, `tauri-plugin-fs@2.5.2`,
  `tauri-plugin@2.6.3`, `tauri-runtime-wry@2.11.4`, `tauri-runtime@2.11.3`, `tauri-utils@2.9.3`,
  `tauri@2.11.6`, `utf8_iter@1.0.4`, `uuid@1.26.1`, `window-vibrancy@0.6.0`,
  `window-vibrancy@0.8.1`, `wry@0.55.1`, `zeroize@1.9.0`

### `Apache-2.0/MIT` (1)

- `postscript@0.14.1`

### `BSD-3-Clause` (3)

- `alloc-no-stdlib@2.0.4`, `alloc-stdlib@0.2.4`, `subtle@2.6.1`

### `BSD-3-Clause AND MIT` (1)

- `brotli@8.0.4`

### `BSD-3-Clause/MIT` (1)

- `brotli-decompressor@5.0.3`

### `CC0-1.0 OR MIT-0 OR Apache-2.0` (1)

- `dunce@1.0.5`

### `CDLA-Permissive-2.0` (1)

- `webpki-roots@1.0.9`

### `ISC` (2)

- `rustls-webpki@0.103.15`, `untrusted@0.9.0`

### `MIT` (48)

- `adobe-cmap-parser@0.4.1`, `block2@0.6.2`, `bytes@1.12.1`, `cargo_metadata@0.19.2`, `cfb@0.7.3`,
  `darling@0.24.1`, `darling_core@0.24.1`, `darling_macro@0.24.1`, `derive_more-impl@2.1.1`,
  `derive_more@2.1.1`, `dom_query@0.27.0`, `ecb@0.1.2`, `embed-resource@3.0.11`,
  `generic-array@0.14.7`, `ico@0.5.0`, `infer@0.19.0`, `lopdf@0.42.0`, `mio@1.2.3`,
  `new_debug_unreachable@1.0.6`, `nom@8.0.0`, `objc2-encode@4.1.0`, `objc2-foundation@0.3.2`,
  `objc2@0.6.4`, `pdf-extract@0.12.1`, `phf@0.13.1`, `phf_codegen@0.13.1`, `phf_generator@0.13.1`,
  `phf_macros@0.13.1`, `phf_shared@0.13.1`, `plist@1.10.1`, `pom@1.1.0`, `precomputed-hash@0.1.1`,
  `quick-xml@0.42.0`, `rfd@0.16.0`, `schemars@0.8.22`, `schemars@0.9.0`, `schemars@1.2.2`,
  `schemars_derive@0.8.22`, `simd-adler32@0.3.10`, `strsim@0.11.1`, `synstructure@0.14.0`,
  `tauri-winres@0.3.6`, `tokio@1.53.1`, `type1-encoding-parser@0.1.1`, `urlpattern@0.3.0`,
  `winnow@0.7.15`, `winnow@1.0.4`, `zmij@1.0.23`

### `MIT / Apache-2.0` (1)

- `euclid@0.20.14`

### `MIT OR Apache-2.0` (142)

- `aes@0.8.4`, `anyhow@1.0.104`, `base64@0.21.7`, `base64@0.22.1`, `base64@0.23.1`, `bitflags@2.13.2`,
  `block-buffer@0.10.4`, `block-padding@0.3.3`, `camino@1.2.6`, `cargo-platform@0.1.9`, `cbc@0.1.2`,
  `cc@1.5.0`, `cff-parser@0.2.0`, `cfg-if@1.0.5`, `chacha20@0.10.2`, `chrono@0.4.45`,
  `cipher@0.4.4`, `cookie@0.18.2`, `core-foundation-sys@0.8.7`, `core-foundation@0.10.1`,
  `core-graphics-types@0.2.0`, `core-graphics@0.25.0`, `cpufeatures@0.2.17`, `cpufeatures@0.3.1`,
  `crc32fast@1.5.2`, `crossbeam-channel@0.5.17`, `crossbeam-utils@0.8.23`, `crypto-common@0.1.7`,
  `defmt-macros@1.1.1`, `defmt-parser@1.0.0`, `defmt@1.1.1`, `deranged@0.5.8`, `digest@0.10.7`,
  `dirs-sys@0.5.0`, `dirs@6.0.0`, `displaydoc@0.2.7`, `dtoa@1.0.11`, `dyn-clone@1.0.20`,
  `embed_plist@1.2.2`, `erased-serde@0.4.10`, `fdeflate@0.3.7`, `find-msvc-tools@0.1.14`,
  `flate2@1.1.10`, `form_urlencoded@1.2.2`, `getrandom@0.2.17`, `getrandom@0.3.4`,
  `getrandom@0.4.3`, `glob@0.3.4`, `hashbrown@0.12.3`, `hashbrown@0.17.1`, `heck@0.5.0`,
  `hex@0.4.3`, `html5ever@0.38.0`, `http@1.5.0`, `httparse@1.10.1`, `iana-time-zone@0.1.65`,
  `idna@1.1.0`, `inout@0.1.4`, `itoa@1.0.18`, `jsonptr@0.6.3`, `keyboard-types@0.7.0`,
  `libc@0.2.189`, `lock_api@0.4.14`, `log@0.4.34`, `markup5ever@0.38.0`, `md-5@0.10.6`,
  `mime@0.3.17`, `num-conv@0.2.2`, `num-traits@0.2.19`, `once_cell@1.21.4`, `parking_lot@0.12.5`,
  `parking_lot_core@0.9.12`, `percent-encoding@2.3.2`, `png@0.17.16`, `png@0.18.1`,
  `powerfmt@0.2.0`, `proc-macro2@1.0.107`, `quote@1.0.47`, `rand@0.10.3`, `rand_core@0.10.1`,
  `ref-cast-impl@1.0.27`, `ref-cast@1.0.27`, `regex-automata@0.4.18`, `regex-syntax@0.8.11`,
  `regex@1.13.1`, `rustc_version@0.4.1`, `rustls-pki-types@1.15.1`, `rustversion@1.0.23`,
  `scopeguard@1.2.0`, `semver@1.0.28`, `serde-untagged@0.1.9`, `serde@1.0.229`,
  `serde_core@1.0.229`, `serde_derive@1.0.229`, `serde_derive_internals@0.29.1`,
  `serde_json@1.0.151`, `serde_repr@0.1.21`, `serde_spanned@1.1.1`, `serde_with@3.23.0`,
  `serde_with_macros@3.23.0`, `serialize-to-javascript-impl@0.1.2`, `serialize-to-javascript@0.1.2`,
  `servo_arc@0.4.3`, `sha2@0.10.9`, `shlex@2.0.1`, `simdutf8@0.1.5`, `siphasher@1.0.4`,
  `smallvec@1.16.2`, `socket2@0.6.5`, `stable_deref_trait@1.2.1`, `string_cache@0.9.0`,
  `string_cache_codegen@0.6.1`, `swift-rs@1.0.8`, `syn@2.0.119`, `syn@3.0.6`, `tendril@0.5.1`,
  `thiserror-impl@1.0.69`, `thiserror-impl@2.0.21`, `thiserror@1.0.69`, `thiserror@2.0.21`,
  `time-core@0.1.9`, `time-macros@0.2.32`, `time@0.3.55`, `toml@0.9.12+spec-1.1.0`,
  `toml@1.1.6+spec-1.1.0`, `toml_datetime@0.7.5+spec-1.1.0`, `toml_datetime@1.1.1+spec-1.1.0`,
  `toml_parser@1.1.3+spec-1.1.0`, `toml_writer@1.1.2+spec-1.1.0`, `tray-icon@0.24.2`,
  `ttf-parser@0.25.1`, `typeid@1.0.3`, `typenum@1.20.1`, `unicode-bidi@0.3.18`,
  `unicode-normalization@0.1.25`, `unicode-segmentation@1.13.3`, `ureq-proto@0.6.4`, `ureq@3.4.2`,
  `url@2.5.8`, `utf8-zero@0.8.1`, `web_atoms@0.2.6`, `weezl@0.1.12`

### `MIT OR Apache-2.0 OR Zlib` (1)

- `raw-window-handle@0.6.2`

### `MIT OR Zlib OR Apache-2.0` (2)

- `miniz_oxide@0.8.9`, `miniz_oxide@0.9.1`

### `MIT/Apache-2.0` (17)

- `bitflags@1.3.2`, `bs58@0.5.1`, `core_detect@1.0.0`, `foreign-types-macros@0.2.4`,
  `foreign-types-shared@0.3.1`, `foreign-types@0.5.0`, `ident_case@1.0.1`, `json-patch@3.0.1`,
  `rangemap@1.8.0`, `stringprep@0.1.5`, `unic-char-property@0.9.0`, `unic-char-range@0.9.0`,
  `unic-common@0.9.0`, `unic-ucd-ident@0.9.0`, `unic-ucd-version@0.9.0`, `unicode-properties@0.1.4`,
  `version_check@0.9.5`

### `MPL-2.0` (5)

- `cssparser-macros@0.6.1`, `cssparser@0.36.0`, `dtoa-short@0.3.5`, `option-ext@0.2.0`,
  `selectors@0.36.1`

### `Unicode-3.0` (18)

- `icu_collections@2.3.0`, `icu_locale_core@2.3.0`, `icu_normalizer@2.3.0`,
  `icu_normalizer_data@2.3.0`, `icu_properties@2.3.0`, `icu_properties_data@2.3.0`,
  `icu_provider@2.3.1`, `litemap@0.8.3`, `potential_utf@0.1.6`, `tinystr@0.8.4`, `writeable@0.6.4`,
  `yoke-derive@0.8.3`, `yoke@0.8.3`, `zerofrom-derive@0.1.8`, `zerofrom@0.1.8`, `zerotrie@0.2.5`,
  `zerovec-derive@0.11.6`, `zerovec@0.11.8`

### `Unlicense OR MIT` (5)

- `aho-corasick@1.1.5`, `byteorder@1.5.0`, `jiff-core@0.1.1`, `jiff@0.2.37`, `memchr@2.8.3`

### `Unlicense/MIT` (2)

- `same-file@1.0.6`, `walkdir@2.5.0`

### `Zlib` (2)

- `foldhash@0.2.0`, `zlib-rs@0.6.8`

### `Zlib OR Apache-2.0 OR MIT` (9)

- `dispatch2@0.3.1`, `objc2-app-kit@0.3.2`, `objc2-core-foundation@0.3.2`,
  `objc2-core-graphics@0.3.2`, `objc2-exception-helper@0.1.1`, `objc2-io-surface@0.3.2`,
  `objc2-quartz-core@0.3.2`, `objc2-web-kit@0.3.2`, `tinyvec@1.13.3`

## Development / Build Tool Licenses To Keep Visible

These packages are marked dev-only in `package-lock.json`; they are build
inputs and may not be part of the shipped runtime. The lockfile remains the
complete source for their names and versions. Counts include optional platform
packages.

| License expression | Packages | Examples in the v3.2.0 lockfile |
| --- | ---: | --- |
| `Apache-2.0` | 25 | `@typescript/typescript-aix-ppc64@7.0.2`, `@typescript/typescript-darwin-arm64@7.0.2`, `@typescript/typescript-darwin-x64@7.0.2` |
| `Apache-2.0 OR MIT` | 12 | `@tauri-apps/cli-darwin-arm64@2.11.5`, `@tauri-apps/cli-darwin-x64@2.11.5`, `@tauri-apps/cli-linux-arm-gnueabihf@2.11.5` |
| `BSD-2-Clause` | 2 | `entities@8.0.0`, `webidl-conversions@8.0.1` |
| `BSD-3-Clause` | 2 | `source-map-js@1.2.1`, `tough-cookie@6.0.2` |
| `BlueOak-1.0.0` | 1 | `lru-cache@11.5.3` |
| `CC0-1.0` | 1 | `mdn-data@2.27.1` |
| `ISC` | 2 | `picocolors@1.1.1`, `saxes@6.0.0` |
| `MIT` | 91 | `@asamuzakjp/css-color@7.0.1`, `@asamuzakjp/dom-selector@9.2.1`, `@babel/code-frame@7.29.7` |
| `MIT-0` | 2 | `@csstools/color-helpers@6.1.1`, `@csstools/css-syntax-patches-for-csstree@1.1.14` |
| `MPL-2.0` | 12 | `lightningcss-android-arm64@1.33.0`, `lightningcss-darwin-arm64@1.33.0`, `lightningcss-darwin-x64@1.33.0` |

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

### `hazakura-core-ai-helper`

The App Store/TestFlight build also carries a separate macOS 27 / Apple
Silicon Core AI adapter sidecar. Keeping it separate preserves the existing
System helper's lower deployment target. No model weights are bundled by this
sidecar build.

Developer Core AI fixture builds use the committed
`src-helpers/apple-assist/CoreAI.Package.resolved`. Production-distribution
adapter builds use the separate
`src-helpers/apple-assist/CoreAIProduction.Package.resolved`. The two entry
dependencies are:

| Component | Pinned version / revision | License observed in checkout |
| --- | --- | --- |
| `apple/coreai-models` (Developer fixture) | `3f109efd54273391f9fd9f5f5b3d8c6e99836d55` | BSD-3-Clause |
| `john-rocky/coreai-kit` (distribution adapter) | `bebe09a050c144034c169af2074fda47fb7ba326` | BSD-3-Clause |
| `john-rocky/coreai-models` via CoreAIKit | `0.2.4-zoo` / `f7a75ec0f89fab451d277572afe8995b7ef768c1` | BSD-3-Clause |
| `huggingface/swift-transformers` | `1.3.4` | Apache-2.0 |
| `huggingface/swift-huggingface` | `0.11.0` | Apache-2.0 |
| `huggingface/swift-jinja` | `2.5.1` | Apache-2.0 |
| `mlc-ai/xgrammar` | `0.2.2` | Apache-2.0 |
| `ibireme/yyjson` | `0.12.0` | MIT |
| `mattt/EventSource` | `1.5.1` | MIT |
| `apple/swift-collections` | `1.6.0` | Apache-2.0 |
| `apple/swift-crypto` | `4.5.2` | Apache-2.0 |
| `apple/swift-asn1` | `1.7.3` | Apache-2.0 |

Before an external TestFlight or App Store submission, include the upstream
license texts required by the linked sidecar graph in the shipped notice set.
The production model assets have separately generated Apache-2.0 text,
revision-pinned provenance records, and (for the 12B conversion) the conflicting
standalone upstream license statement preserved verbatim; see
`docs/core-ai-production-models.md`. Human license review remains required. This
dependency table does not itself approve the model weights for release.

## Final Distribution Checklist

- Refresh `package-lock.json` and `src-tauri/Cargo.lock` license scans before
  each submission package. Latest tracked macOS lockfile refresh: 2026-09-25.
- Refresh both Core AI Swift graphs from the committed `CoreAI.Package.resolved`
  and `CoreAIProduction.Package.resolved`, and confirm the full upstream
  license-text bundle before submission.
- Confirm which dependencies are actually bundled in App Store and Developer /
  GitHub builds.
- Preserve DOMPurify under the Apache-2.0 notice option or record a deliberate
  policy change.
- Preserve the `encoding_rs` BSD-3-Clause WHATWG-data notice.
- Include full license texts or upstream notice files for MIT, Apache-2.0,
  BSD-2-Clause, BSD-3-Clause, MPL-2.0, CC0-1.0, CDLA-Permissive-2.0,
  BlueOak-1.0.0, 0BSD, MIT-0, ISC, Unicode-3.0, Unlicense, Zlib, and any
  LGPL-option component that remains in the distributed dependency graph.
- Confirm icon/logo source provenance.
- Confirm whether the shipped app exposes this notice in the app bundle,
  release assets, in-app About surface, or all of the above.
