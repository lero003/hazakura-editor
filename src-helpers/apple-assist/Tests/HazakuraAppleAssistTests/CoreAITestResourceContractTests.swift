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

    private func writeProductionMetadata(
        at root: URL,
        modelId: String = "apple:core-ai:writing-primary",
        runtimeKind: String,
        layout: [String: String],
        releaseEligible: Bool = false
    ) throws {
        let object: [String: Any] = [
            "schemaVersion": 1,
            "modelId": modelId,
            "runtimeKind": runtimeKind,
            "releaseEligible": releaseEligible,
            "layout": layout,
            "licensing": [
                "reviewStatus": "manual-review-required",
                "licenseFiles": ["LICENSE-APACHE-2.0.txt"],
            ],
        ]
        try JSONSerialization.data(withJSONObject: object).write(
            to: root.appendingPathComponent("hazakura-model.json")
        )
        try Data("license".utf8).write(to: root.appendingPathComponent("LICENSE-APACHE-2.0.txt"))
        try Data("notice".utf8).write(to: root.appendingPathComponent("THIRD_PARTY_MODEL_NOTICE.md"))
    }

    private func writeLanguageBundle(at root: URL, name: String = "writing-model.aimodel") throws {
        let tokenizer = root.appendingPathComponent("tokenizer", isDirectory: true)
        let model = root.appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(at: tokenizer, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: model, withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: root.appendingPathComponent("metadata.json"))
        try Data("{}".utf8).write(to: tokenizer.appendingPathComponent("tokenizer.json"))
        try Data("{}".utf8).write(to: tokenizer.appendingPathComponent("tokenizer_config.json"))
        try Data("template".utf8).write(to: tokenizer.appendingPathComponent("chat_template.jinja"))
        try Data("{}".utf8).write(to: model.appendingPathComponent("metadata.json"))
        try Data("hash".utf8).write(to: model.appendingPathComponent("main.hash"))
        try Data("model".utf8).write(to: model.appendingPathComponent("main.mlirb"))
    }

    func testProductionContractAcceptsLockedLanguageLayout() throws {
        let root = try makeTemporaryDirectory()
        let bundle = root.appendingPathComponent("bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: bundle, withIntermediateDirectories: true)
        try writeLanguageBundle(at: bundle)
        try writeProductionMetadata(
            at: root,
            runtimeKind: "coreai-kit-language",
            layout: ["bundle": "bundle"]
        )

        let expected = CoreAIProductionResource(
            root: root,
            runtimeKind: .language,
            bundle: bundle,
            modelDirectory: bundle.appendingPathComponent("writing-model.aimodel", isDirectory: true),
            tables: nil
        )
        XCTAssertEqual(
            CoreAIResourceContract.validate(
                path: root.path,
                expectedModelId: "apple:core-ai:writing-primary"
            ),
            .ready(expected)
        )
    }

    func testProductionContractAcceptsGemmaPLELayoutOnlyWithTables() throws {
        let root = try makeTemporaryDirectory()
        let decoder = root.appendingPathComponent("decoder", isDirectory: true)
        let tables = root.appendingPathComponent("tables", isDirectory: true)
        try FileManager.default.createDirectory(at: decoder, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: tables, withIntermediateDirectories: true)
        try writeLanguageBundle(at: decoder)
        try Data("table".utf8).write(to: tables.appendingPathComponent("embed_per_layer.i8"))
        try Data("scale".utf8).write(to: tables.appendingPathComponent("embed_per_layer.scale.f32"))
        try writeProductionMetadata(
            at: root,
            runtimeKind: "coreai-kit-gemma4-ple",
            layout: ["decoder": "decoder", "tables": "tables"]
        )

        guard case .ready(let resource) = CoreAIResourceContract.validate(
            path: root.path,
            expectedModelId: "apple:core-ai:writing-primary"
        ) else { return XCTFail("Gemma PLE layout must be accepted") }
        XCTAssertEqual(resource.runtimeKind, .gemma4PLE)
        XCTAssertEqual(resource.bundle, decoder)
        XCTAssertEqual(
            resource.modelDirectory,
            decoder.appendingPathComponent("writing-model.aimodel", isDirectory: true)
        )
        XCTAssertEqual(resource.tables, tables)

        try FileManager.default.removeItem(at: tables.appendingPathComponent("embed_per_layer.i8"))
        XCTAssertEqual(
            CoreAIResourceContract.validate(
                path: root.path,
                expectedModelId: "apple:core-ai:writing-primary"
            ),
            .invalid
        )
    }

    func testProductionSignatureFollowsTheRealModelHashAndTokenizer() throws {
        let root = try makeTemporaryDirectory()
        let bundle = root.appendingPathComponent("bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: bundle, withIntermediateDirectories: true)
        try writeLanguageBundle(at: bundle)
        try writeProductionMetadata(
            at: root,
            runtimeKind: "coreai-kit-language",
            layout: ["bundle": "bundle"]
        )

        guard case .ready(let resource) = CoreAIResourceContract.validate(
            path: root.path,
            expectedModelId: "apple:core-ai:writing-primary"
        ) else {
            return XCTFail("Expected a ready production resource")
        }
        let baseline = try XCTUnwrap(CoreAIResourceContract.signature(for: resource))
        XCTAssertTrue(baseline.contains("main.hash="))

        // The verified `.aimodel/main.hash` is the model identity.
        let modelHash = resource.modelDirectory.appendingPathComponent("main.hash")
        try Data("a-different-hash".utf8).write(to: modelHash)
        let afterHash = try XCTUnwrap(CoreAIResourceContract.signature(for: resource))
        XCTAssertNotEqual(baseline, afterHash)

        // Tokenizer settings decide stopping and prompt formatting.
        let tokenizerConfig = resource.bundle
            .appendingPathComponent("tokenizer/tokenizer_config.json")
        try Data("{\"eos_token\":\"<eos>\"}".utf8).write(to: tokenizerConfig)
        let afterTokenizer = try XCTUnwrap(CoreAIResourceContract.signature(for: resource))
        XCTAssertNotEqual(afterHash, afterTokenizer)

        // A required input that cannot be read must not look like "unchanged".
        try FileManager.default.removeItem(at: modelHash)
        XCTAssertNil(CoreAIResourceContract.signature(for: resource))
    }

    func testProductionContractRejectsWrongIdentity() throws {
        let root = try makeTemporaryDirectory()
        let bundle = root.appendingPathComponent("bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: bundle, withIntermediateDirectories: true)
        try writeLanguageBundle(at: bundle)
        try writeProductionMetadata(
            at: root,
            modelId: "apple:core-ai:different",
            runtimeKind: "coreai-kit-language",
            layout: ["bundle": "bundle"]
        )

        XCTAssertEqual(
            CoreAIResourceContract.validate(
                path: root.path,
                expectedModelId: "apple:core-ai:writing-primary"
            ),
            .invalid
        )

    }

    func testProductionContractRejectsSymlinkedLicenseEvidence() throws {
        let root = try makeTemporaryDirectory()
        let bundle = root.appendingPathComponent("bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: bundle, withIntermediateDirectories: true)
        try writeLanguageBundle(at: bundle)
        try writeProductionMetadata(
            at: root,
            runtimeKind: "coreai-kit-language",
            layout: ["bundle": "bundle"]
        )
        let external = try makeTemporaryDirectory().appendingPathComponent("license.txt")
        try Data("outside".utf8).write(to: external)
        let license = root.appendingPathComponent("LICENSE-APACHE-2.0.txt")
        try FileManager.default.removeItem(at: license)
        try FileManager.default.createSymbolicLink(at: license, withDestinationURL: external)

        XCTAssertEqual(
            CoreAIResourceContract.validate(
                path: root.path,
                expectedModelId: "apple:core-ai:writing-primary"
            ),
            .invalid
        )
    }
}
