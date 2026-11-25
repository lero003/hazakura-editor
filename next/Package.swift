// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "HazakuraNext",
    platforms: [.macOS(.v26)],
    products: [.executable(name: "HazakuraNext", targets: ["HazakuraNext"])],
    targets: [
        .target(name: "HazakuraNextCore"),
        .target(name: "HazakuraNextEditor"),
        .executableTarget(
            name: "HazakuraNext",
            dependencies: ["HazakuraNextCore", "HazakuraNextEditor"]
        ),
        .testTarget(name: "HazakuraNextCoreTests", dependencies: ["HazakuraNextCore"]),
        .testTarget(name: "HazakuraNextEditorTests", dependencies: ["HazakuraNextEditor"]),
        .testTarget(name: "HazakuraNextTests", dependencies: ["HazakuraNext", "HazakuraNextCore"]),
    ]
)
