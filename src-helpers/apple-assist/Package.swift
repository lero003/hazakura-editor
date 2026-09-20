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
import Foundation

let coreAITestBuild = ProcessInfo.processInfo.environment["HAZAKURA_COREAI_TEST_BUILD"] == "1"
let coreAIModelsPath = "../../.hazakura/coreai-test/coreai-models-3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
let packageDependencies: [Package.Dependency] = coreAITestBuild
    ? [.package(path: coreAIModelsPath)]
    : []
let targetDependencies: [Target.Dependency] = coreAITestBuild
    ? [.product(
        name: "CoreAILM",
        package: "coreai-models-3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
    )]
    : []
let helperSwiftSettings: [SwiftSetting] = [
    .define("FIXTURE_MODE", .when(configuration: .debug))
] + (coreAITestBuild ? [.define("COREAI_TEST_BACKEND")] : [])

let package = Package(
    name: "HazakuraAppleAssist",
    platforms: coreAITestBuild ? [.macOS("27.0")] : [.macOS(.v13)],
    dependencies: packageDependencies,
    targets: [
        .executableTarget(
            name: "HazakuraAppleAssist",
            dependencies: targetDependencies,
            path: "Sources/HazakuraAppleAssist",
            swiftSettings: helperSwiftSettings
        ),
        .testTarget(
            name: "HazakuraAppleAssistTests",
            dependencies: ["HazakuraAppleAssist"]
        )
    ]
)
