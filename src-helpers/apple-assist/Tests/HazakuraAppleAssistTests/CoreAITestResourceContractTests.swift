import XCTest
@testable import HazakuraAppleAssist

final class CoreAITestResourceContractTests: XCTestCase {
    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("hazakura-coreai-resource-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }

    func testMissingResourceIsDistinctFromMalformedResource() throws {
        let missing = FileManager.default.temporaryDirectory
            .appendingPathComponent("hazakura-coreai-missing-\(UUID().uuidString)", isDirectory: true)
        XCTAssertEqual(
            CoreAITestResourceContract.validate(path: missing.path),
            .missing
        )

        let malformed = try makeTemporaryDirectory()
        XCTAssertEqual(
            CoreAITestResourceContract.validate(path: malformed.path),
            .invalid
        )
    }

    func testAcceptsOnlyTheFixedBundleShape() throws {
        let root = try makeTemporaryDirectory()
        let tokenizer = root.appendingPathComponent("tokenizer", isDirectory: true)
        let model = root.appendingPathComponent("hazakura-qwen3-0.6b-test.aimodel", isDirectory: true)
        try FileManager.default.createDirectory(at: tokenizer, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: model, withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: root.appendingPathComponent("metadata.json"))
        try Data("license".utf8).write(to: root.appendingPathComponent("LICENSE"))
        try Data("{}".utf8).write(to: tokenizer.appendingPathComponent("tokenizer.json"))
        try Data("{}".utf8).write(to: model.appendingPathComponent("metadata.json"))
        try Data("hash".utf8).write(to: model.appendingPathComponent("main.hash"))
        try Data("model".utf8).write(to: model.appendingPathComponent("main.mlirb"))

        XCTAssertEqual(CoreAITestResourceContract.validate(path: root.path), .ready(root))
    }

    func testProductionContractAcceptsOneNamedAimodelBundle() throws {
        let root = try makeTemporaryDirectory()
        let tokenizer = root.appendingPathComponent("tokenizer", isDirectory: true)
        let model = root.appendingPathComponent("writing-model.aimodel", isDirectory: true)
        try FileManager.default.createDirectory(at: tokenizer, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: model, withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: root.appendingPathComponent("metadata.json"))
        try Data("license".utf8).write(to: root.appendingPathComponent("LICENSE"))
        try Data("{}".utf8).write(to: tokenizer.appendingPathComponent("tokenizer.json"))
        try Data("{}".utf8).write(to: model.appendingPathComponent("metadata.json"))
        try Data("hash".utf8).write(to: model.appendingPathComponent("main.hash"))
        try Data("model".utf8).write(to: model.appendingPathComponent("main.mlirb"))

        XCTAssertEqual(CoreAIResourceContract.validate(path: root.path), .ready(root))

        let secondModel = root.appendingPathComponent("second.aimodel", isDirectory: true)
        try FileManager.default.createDirectory(at: secondModel, withIntermediateDirectories: true)
        XCTAssertEqual(CoreAIResourceContract.validate(path: root.path), .invalid)
    }
}
