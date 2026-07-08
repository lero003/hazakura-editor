// swift-tools-version:5.9
//
// `hazakura-import-assist-helper` — PDFKit text extract + Vision OCR sidecar.
// JSON-over-stdio, fixed binary path (same trust pattern as Local Assist).
//
// Flavors:
//   * live (release) — PDFKit + Vision on macOS
//   * fixture (debug / -DFIXTURE_MODE) — canned responses for CI

import PackageDescription

let package = Package(
    name: "HazakuraImportAssist",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "HazakuraImportAssist",
            path: "Sources/HazakuraImportAssist",
            swiftSettings: [
                .define("FIXTURE_MODE", .when(configuration: .debug))
            ]
        )
    ]
)
