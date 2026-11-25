// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "HazakuraNext",
    platforms: [.macOS(.v26)],
    products: [
        .executable(name: "HazakuraNext", targets: ["HazakuraNext"]),
        .executable(name: "HazakuraNextModelProbe", targets: ["HazakuraNextModelProbe"]),
        .executable(name: "HazakuraNextLayoutProbe", targets: ["HazakuraNextLayoutProbe"]),
    ],
    targets: [
        .target(name: "HazakuraNextCore"),
        .target(name: "HazakuraNextEditor", dependencies: ["HazakuraNextCore"]),
        .executableTarget(
            name: "HazakuraNext",
            dependencies: ["HazakuraNextCore", "HazakuraNextEditor"]
        ),
        .executableTarget(name: "HazakuraNextModelProbe"),
        .executableTarget(name: "HazakuraNextLayoutProbe", dependencies: ["HazakuraNextEditor"]),
        .testTarget(name: "HazakuraNextLayoutProbeTests", dependencies: ["HazakuraNextLayoutProbe"]),
        .testTarget(name: "HazakuraNextModelProbeTests", dependencies: ["HazakuraNextModelProbe"]),
        .testTarget(name: "HazakuraNextCoreTests", dependencies: ["HazakuraNextCore"]),
        .testTarget(name: "HazakuraNextEditorTests", dependencies: ["HazakuraNextEditor"]),
        .testTarget(name: "HazakuraNextTests", dependencies: ["HazakuraNext", "HazakuraNextCore"]),
    ]
)
