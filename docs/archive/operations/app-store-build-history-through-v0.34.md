# App Store Build Package History Through v0.34

Status: Archive
Scope: Historical per-version App Store package-candidate notes and SHA-256 records moved out of docs/app-store-build.md
Authority: Low
Last reviewed: 2026-06-29

This file preserves the v0.18-v0.34 per-build package-candidate notes, SHA-256
values, and Transporter / TestFlight / App Review status that previously lived
in the App Store Connect Status Notes section of `docs/app-store-build.md`.
Per-build pkg path / SHA-256 values are no longer carried in tracked docs;
consult `docs/internal/app-store-candidates/latest.json` for the active
artifact. Read this archive only for historical context.

---


## Per-version Package Candidate Notes (v0.18-v0.34)


v0.18 release-prep note: the warning-expected Developer / GitHub DMG app
launched locally and from the mounted DMG. An earlier ad-hoc helper-free
App Store preview bundle that carried App Store sandbox entitlements failed
with `RBSRequestErrorDomain Code=5` / `Launchd job spawn failed`, so local
`npm run build` smoke now skips those entitlements. Treat App Store-lane
launch validation as part of the signed submit / TestFlight proof, not as
covered by local ad-hoc entitlement probes.

v0.18 TestFlight note: on 2026-06-12, the signed
`HazakuraEditor-0.18.0-mas.pkg` for app version `0.18.0` and build `4`
was delivered through Transporter and reached TestFlight distribution
with no reported Apple validation warnings. Basic launch and save smoke
on the TestFlight build passed. Fuller manual smoke, final metadata, and
App Review submission / approval remain separate evidence.

v0.19 approval note: the user-visible app version `0.19.0` passed App
Review and was published on 2026-06-18. The public listing is
`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
The tracked submit-lane candidate for the approval was build counter
`14`; do not reuse the `0.18.0` build `4` TestFlight result as proof for
future submissions.
In local Codex packaging, the signed submit-lane bundle reported the
expected `0.19.0` / `14` metadata, `15.0` minimum macOS, and
entitlements. Local Gatekeeper
assessment can still report `Insufficient Context` for this lane; treat
launch validation for a future build as signed TestFlight or App Store
proof, not as covered by local package inspection alone.

The local release-candidate package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.19.0-build14-mas.pkg
```

`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="15.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so treat that as local trust-policy evidence rather than
an App Store Connect validation result. SHA-256:

```txt
85aa5f5ce887a2639f7905b418adb9aadabbe30a9541f08ef7520c08e603048c
```

v0.20 package-candidate note: on 2026-06-19, Codex generated a local
App Store submit-lane package for user-visible version `0.20.0` and
App Store build counter `16`. This package was superseded before upload
when the release target moved to `0.25.0`. Do not submit this package;
the replacement local candidate is the `0.25.0` build `18` package
recorded below.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.20.0-build16-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.20.0`,
`CFBundleVersion` `16`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Hazakura Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so keep treating that as local trust-policy evidence
rather than an App Store Connect validation result. SHA-256:

```txt
b2bf37df86b7e589dd34411635f68988b27b24a9db87f7125833c1471938eb50
```

v0.25 package-candidate note: on 2026-06-19, Codex generated a local
App Store submit-lane package for user-visible version `0.25.0` and
App Store build counter `18`. The `0.25.0` App Store update was later
reported as released on 2026-06-20. This note is still local packaging
evidence only; raw App Store Connect, TestFlight, and App Review logs
are not tracked here.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.25.0-build18-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.25.0`,
`CFBundleVersion` `18`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Hazakura Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so keep treating that as local trust-policy evidence
rather than an App Store Connect validation result. SHA-256:

```txt
211ed7ffa935929cb4d3e31e88b6d9034c08a2335876e3f3fbf61a90e4400b61
```

v0.26 package/release note: on 2026-06-20, Codex generated a local App
Store submit-lane package for user-visible version `0.26.0` and App
Store build counter `21` after correcting the Japanese e-book label to
`電子書籍`. The update was later reported as App Review-complete and
released on the Mac App Store on 2026-06-20. This repository tracks the
local package evidence; raw App Store Connect, TestFlight, and App
Review logs are not tracked here.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.26.0-build21-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.26.0`,
`CFBundleVersion` `21`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Hazakura Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so keep treating that as local trust-policy evidence
rather than an App Store Connect validation result. SHA-256:

```txt
1cc4f694334badc7a408c0e61278ee40b340a0939378d082de9bfe41e44df515
```

v0.27 package-candidate note: on 2026-06-20, a local App Store
submit-lane package was generated for user-visible version `0.27.0` and
App Store build counter `22` after the `v0.27.0` source / local-app tag.
Upload, App Store Connect processing, TestFlight, App Review, and
release handling are outside this repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.27.0-build22-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.27.0`,
`CFBundleVersion` `22`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Hazakura Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- <app>`
passed for the generated app. `pkgutil --check-signature` passed with
the 3rd Party Mac Developer Installer certificate. `spctl` rejected or
returned inconclusive local assessment for the signed app, so keep
treating that as local trust-policy evidence rather than an App Store
Connect validation result. SHA-256:

```txt
3cf8a09dcf4b3fd81d50ad330d552c0e7de30ec56713b2fc4b4f2a62ae913ff7
```

v0.28 package-candidate note: on 2026-06-21, Codex generated a local
App Store submit-lane package for user-visible version `0.28.0` and
App Store build counter `26` after the v0.28 safety / quality / AI
review foundation slice and the later top-chrome quieting pass.
Upload, App Store Connect processing,
TestFlight, App Review, and release handling are outside this repository
unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.28.0-build26-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.28.0`,
`CFBundleVersion` `26`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Hazakura Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- <app>`
passed for the generated app. `productbuild --synthesize` emitted a
Distribution XML `allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` rejected or returned inconclusive local
assessment for the signed app, so keep treating that as local
trust-policy evidence rather than an App Store Connect validation
result. SHA-256:

```txt
32b2e0dfee55c793b4cac5a127657cc7d2fe8b32af4341102acf387ad60dcd88
```

v0.29 package-candidate note: on 2026-06-22, Transporter rejected the
first local `0.29.0` build `28` package because the bundled
Hazakura Local Assist helper only carried
`com.apple.security.inherit` and lacked
`com.apple.security.app-sandbox`. Codex updated the helper entitlement
file and distribution probe, then generated a replacement local App
Store submit-lane package for user-visible version `0.29.0` and App
Store build counter `29`. The user reported successful Transporter
delivery for this corrected package on 2026-06-22. App Store Connect
processing, TestFlight, App Review, and release handling are outside
this repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.29.0-build29-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.29.0`,
`CFBundleVersion` `29`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present, executable, Apple Distribution signed, still used the previous
Apple-branded helper executable name, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
`REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- <app>`
passed for the generated app, and expanded-package payload inspection
confirmed the same helper entitlements in the pkg payload.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` rejected or returned inconclusive local
assessment for the signed app, so keep treating that as local
trust-policy evidence rather than an App Store Connect validation
result. SHA-256:

```txt
37e8afb8e34520e760c4150565dfe0616498d4768a00e3ef3edafbc4291f27bd
```

v0.29 build 30 local package note: on 2026-06-22, Codex generated a new
local App Store submit-lane package for user-visible version `0.29.0`
after renaming the bundled helper executable to
`hazakura-local-assist-helper`. The package was opened in Transporter
GUI, but CLI delivery was not completed from Codex because App Store
Connect authentication environment variables were not set. App Store
Connect upload completion, processing, TestFlight, App Review, and
release handling remain separate evidence unless the user records them.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.29.0-build30-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.29.0`,
`CFBundleVersion` `30`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper
was present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The package payload expansion confirmed the same helper name and helper
entitlements, and confirmed the previous Apple-branded helper executable
was absent. The App Store entitlement-enforced macOS distribution probe
passed for the generated app.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` rejected the local package, so keep
treating that as local trust-policy evidence rather than an App Store
Connect validation result. SHA-256:

```txt
7170f4fb1aba3ad0e37d7aacf207408c38a92fb618678a01e1afc1d3030647f2
```

v0.29.1 build 31 local package note: on 2026-06-22, Codex generated a
new local App Store submit-lane package for user-visible version
`0.29.1` after Local Assist streaming responsiveness, target-editor lock,
prompt simplification, and review-facing settings polish. App Store
Connect upload completion, processing, TestFlight, App Review, and release
handling remain separate evidence unless the user records them.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.29.1-build31-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.29.1`,
`CFBundleVersion` `31`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store entitlement-enforced macOS distribution probe and sandbox
preview smoke passed for the generated app.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` rejected or returned inconclusive local
assessment, so keep treating that as local trust-policy evidence rather
than an App Store Connect validation result. SHA-256:

```txt
40004f6a01c6bf8c26be72f191ebcacb6cc485762a9028ad29b4c91ec0f587df
```

v0.29.1 build 33 App Store approval note: on 2026-06-22, Codex
generated a new local App Store submit-lane package for user-visible
version `0.29.1` after the Markdown preview flicker fix. This package
supersedes build `31` as the final local package evidence for the
`0.29.1` review cycle. On 2026-06-23, the user reported that `0.29.1`
passed App Review and was released on the Mac App Store with Hazakura
Local Assist public as a preview local AI writing companion. Raw App
Store Connect, TestFlight, and App Review logs are not tracked in this
repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.29.1-build33-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.29.1`,
`CFBundleVersion` `33`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store entitlement-enforced macOS distribution probe and sandbox
preview smoke passed for the generated app.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` remained local trust-policy noise for
this lane. SHA-256:

```txt
f2ae163a61ab7b8ea0084c043c030f629b5bc39eba23b4d7d64e0b8769cd2ec4
```

v0.31.0 build 34 TestFlight candidate note: on 2026-06-23, Codex
generated a new local App Store submit-lane package for user-visible
version `0.31.0` after the v0.31 Reading Focus / Spread View work and
the image-only page hardening pass. This package is intended for
TestFlight-side visual smoke. Raw App Store Connect upload, processing,
TestFlight install / launch, and App Review logs are not tracked in this
repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.31.0-build34-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.31.0`,
`CFBundleVersion` `34`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store entitlement-enforced macOS distribution probe and sandbox
preview smoke passed for the generated app.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` remained local trust-policy noise for
this lane. SHA-256:

```txt
acc1c3f59ce7801d86689df888451d8c562e9c8b612b7368b7d0d5188dbd2353
```

v0.31.0 build 35 TestFlight candidate note: on 2026-06-23, Codex
generated a new local App Store submit-lane package for user-visible
version `0.31.0` after the v0.31 Reading Focus contents-drawer polish
and the post-build margin / spread-navigation / page-offset fixes. This
package supersedes build `34` as the latest local TestFlight candidate
evidence. Raw App Store Connect upload, processing, TestFlight install /
launch, and App Review logs are not tracked in this repository unless
separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.31.0-build35-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.31.0`,
`CFBundleVersion` `35`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store entitlement-enforced macOS distribution probe and sandbox
preview smoke passed for the generated app. `pkgutil --expand-full`
exposed a Distribution XML `allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` remained local trust-policy noise for
this lane. SHA-256:

```txt
9ec936c7e092424986e737a855ce379453d7d9f7aaf61df260ff9e4d5c2971f6
```

v0.32.0 build 36 TestFlight candidate note: on 2026-06-23, Codex
generated a new local App Store submit-lane package for user-visible
version `0.32.0` after the v0.32 Editor / Reader Position Bridge work.
This package supersedes build `35` as the latest local TestFlight
candidate evidence. Raw App Store Connect upload, processing,
TestFlight install / launch, and App Review logs are not tracked in this
repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.32.0-build36-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.32.0`,
`CFBundleVersion` `36`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store entitlement-enforced macOS distribution probe and sandbox
preview smoke passed for the generated app. `pkgutil --expand-full`
exposed a Distribution XML `allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl` remained local trust-policy noise for
this lane. SHA-256:

```txt
67111daae523027c4e1aca73fe39272116b342f3d71668a7050f4fa6a0f94981
```

v0.33.0 build 39 TestFlight candidate note: on 2026-06-25, Codex
generated a new local App Store submit-lane package for user-visible
version `0.33.0` after the v0.33 EPUB Export v1 Polish, workspace marker,
and right-click slash-command source work. This package supersedes
build `36` as the latest local package evidence. Raw App Store Connect
upload, processing, TestFlight install / launch, and App Review logs are
not tracked in this repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.33.0-build39-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.33.0`,
`CFBundleVersion` `39`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store surface smoke, macOS distribution probe, package signature
check, and sandbox preview smoke passed for the generated app/package.
`spctl` remained local trust-policy noise for this lane. SHA-256:

```txt
69f6e50866fcefc107212eb96475e181ba25023b7ce9ebb2592a013b2d41e32f
```

v0.34.0 build 46 TestFlight candidate note: on 2026-06-25, Codex
generated a new local App Store submit-lane package for user-visible
version `0.34.0` after replacing the PDF print browser / OS handoff with
an app-owned native print webview and removing the stale handoff path.
This package superseded the v0.33 build `41` candidate as local package
evidence, but is itself superseded for PDF output because TestFlight
still showed macOS' print-unsupported alert. Raw App Store Connect
upload, processing, TestFlight install / launch, and App Review logs are
not tracked in this repository unless separately recorded.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.34.0-build46-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.34.0`,
`CFBundleVersion` `46`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements. The bundled Hazakura Local Assist helper was
present as `Contents/MacOS/hazakura-local-assist-helper`, executable,
Apple Distribution signed, and carried both
`com.apple.security.app-sandbox` and `com.apple.security.inherit`.
The App Store surface smoke, macOS distribution probe, strict codesign
verification, package signature check, Info.plist version/build checks,
package SHA check, and sandbox preview smoke passed for the generated
app/package. `spctl` remained local trust-policy noise for this lane.
SHA-256:

```txt
78ce80cd1bcefd462241ec365679c5842a933dcd52ae3944b9d89b9467b5ec30
```
