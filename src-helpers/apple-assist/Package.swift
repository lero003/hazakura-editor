// swift-tools-version:5.9
//
// `hazakura-apple-assist-helper` is the Swift sidecar binary
// that owns the FoundationModels binding for Hazakura Local Assist.
//
// It is built as a standalone executable so the Tauri / Rust
// crate can stay cross-platform (non-macOS contributors do NOT
// need Xcode), and so the Foundation Models entry point lives
// behind a clean JSON-over-stdio process boundary.
//
// Two build flavors:
//   * default (live mode) — links FoundationModels.framework,
//     requires macOS 26+ and Apple Intelligence enabled.
//   * `-DFIXTURE_MODE` — returns canned JSON responses without
//     touching FoundationModels. Used by CI on non-Apple-Silicon
//     Macs and for the Rust integration test loop.
//
// The two modes share `main.swift`, `Request.swift`, and
// `Response.swift`; the live-vs-fixture switch is at the call
// site of `GenerateCandidate.run`.

import PackageDescription

let package = Package(
    name: "HazakuraAppleAssist",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "HazakuraAppleAssist",
            path: "Sources/HazakuraAppleAssist",
            swiftSettings: [
                .define("FIXTURE_MODE", .when(configuration: .debug))
            ]
        )
    ]
)
