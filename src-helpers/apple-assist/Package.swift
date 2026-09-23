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

let coreAIRevision = "3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
let coreAIKitRevision = "bebe09a050c144034c169af2074fda47fb7ba326"
let coreAITestBuild = ProcessInfo.processInfo.environment["HAZAKURA_COREAI_TEST_BUILD"] == "1"
let coreAIDistributionBuild = ProcessInfo.processInfo.environment["HAZAKURA_COREAI_DISTRIBUTION_BUILD"] == "1"
precondition(
    !(coreAITestBuild && coreAIDistributionBuild),
    "Core AI test and production distribution flavors are mutually exclusive."
)
let coreAIBackendBuild = coreAITestBuild || coreAIDistributionBuild
let packageDependencies: [Package.Dependency]
let targetDependencies: [Target.Dependency]
if coreAITestBuild {
    packageDependencies = [.package(url: "https://github.com/apple/coreai-models", revision: coreAIRevision)]
    targetDependencies = [.product(
        name: "CoreAILM",
        package: "coreai-models"
    )]
} else if coreAIDistributionBuild {
    packageDependencies = [.package(
        url: "https://github.com/john-rocky/coreai-kit",
        revision: coreAIKitRevision
    )]
    targetDependencies = [.product(
        name: "CoreAIKit",
        package: "coreai-kit"
    )]
} else {
    packageDependencies = []
    targetDependencies = []
}
let helperSwiftSettings: [SwiftSetting] = [
    .define("FIXTURE_MODE", .when(configuration: .debug))
] + (coreAIBackendBuild ? [.define("COREAI_BACKEND")] : [])
  + (coreAITestBuild ? [.define("COREAI_TEST_BACKEND")] : [])
  + (coreAIDistributionBuild ? [.define("COREAI_PRODUCT_BACKEND")] : [])
let testDependencies: [Target.Dependency] = ["HazakuraAppleAssist"]
  + (coreAIDistributionBuild ? [.product(name: "CoreAIKit", package: "coreai-kit")] : [])

let package = Package(
    name: "HazakuraAppleAssist",
    platforms: coreAIBackendBuild ? [.macOS("27.0")] : [.macOS(.v13)],
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
            dependencies: testDependencies
        )
    ]
)
