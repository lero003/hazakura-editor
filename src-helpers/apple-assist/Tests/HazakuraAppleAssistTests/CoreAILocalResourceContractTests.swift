import XCTest
@testable import HazakuraAppleAssist

final class CoreAILocalResourceContractTests: XCTestCase {
    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("hazakura-coreai-local-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }

    private func write(_ contents: String, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(contents.utf8).write(to: url)
    }

    func testAcceptsABareLanguageResourceSelectedByItsRoot() throws {
        let root = try languageResource()

        let resolution = CoreAILocalResourceContract.resolve(path: root.path)

        guard let resource = resolution.resource else {
            return XCTFail("expected ready, got \(String(describing: resolution.errorCode))")
        }
        XCTAssertEqual(resource.runtimeKind, .language)
        XCTAssertEqual(resource.modelId, nil)
        XCTAssertEqual(resource.modelDirectory.lastPathComponent, "local.aimodel")
    }

    func testAcceptsABareLanguageResourceSelectedByItsAimodelDirectory() throws {
        let root = try languageResource()

        let resolution = CoreAILocalResourceContract.resolve(
            path: root.appendingPathComponent("local.aimodel").path
        )

        guard let resource = resolution.resource else {
            return XCTFail("expected ready, got \(String(describing: resolution.errorCode))")
        }
        XCTAssertEqual(resource.resourceRoot.resolvingSymlinksInPath(), root.resolvingSymlinksInPath())
    }

    func testLocalResourceSignatureChangesWithTokenizerOrModelIdentity() throws {
        let root = try languageResource()
        let first = try XCTUnwrap(CoreAILocalResourceContract.resolve(path: root.path).resource)
        let baseline = try XCTUnwrap(CoreAILocalResourceContract.signature(for: first))

        try write("changed tokenizer", to: root.appendingPathComponent("tokenizer/tokenizer.json"))
        let tokenizerChanged = try XCTUnwrap(
            CoreAILocalResourceContract.resolve(path: root.path).resource
        )
        let tokenizerSignature = try XCTUnwrap(
            CoreAILocalResourceContract.signature(for: tokenizerChanged)
        )
        XCTAssertNotEqual(tokenizerSignature, baseline)

        try write("changed hash", to: root.appendingPathComponent("local.aimodel/main.hash"))
        let modelChanged = try XCTUnwrap(
            CoreAILocalResourceContract.resolve(path: root.path).resource
        )
        XCTAssertNotEqual(
            CoreAILocalResourceContract.signature(for: modelChanged),
            tokenizerSignature
        )
    }

    /// The production gate and the local gate must stay distinct. A local bundle
    /// has no reviewed licence or notice evidence, so the production contract
    /// rejects it while the local contract accepts it as a structural bundle.
    func testLocalContractAcceptsALicenceFreeBundleThatTheProductionContractRejects() throws {
        let root = try makeTemporaryDirectory()
        try write(
            #"{"schemaVersion":1,"modelId":"local:test:language","runtimeKind":"coreai-kit-language","layout":{"bundle":"bundle"}}"#,
            to: root.appendingPathComponent("hazakura-model.json")
        )
        let bundle = root.appendingPathComponent("bundle", isDirectory: true)
        try write("{}", to: bundle.appendingPathComponent("metadata.json"))
        try write("{}", to: bundle.appendingPathComponent("tokenizer/tokenizer.json"))
        try write("{}", to: bundle.appendingPathComponent("local.aimodel/metadata.json"))
        try write("hash", to: bundle.appendingPathComponent("local.aimodel/main.hash"))
        try write("model", to: bundle.appendingPathComponent("local.aimodel/main.mlirb"))

        XCTAssertEqual(
            CoreAIResourceContract.validate(
                path: root.path,
                expectedModelId: "local:test:language"
            ),
            .invalid
        )
        XCTAssertEqual(
            CoreAILocalResourceContract.resolve(path: root.path).errorCode,
            nil
        )
    }

    func testRejectsASymlinkedTokenizerDirectory() throws {
        let root = try makeTemporaryDirectory()
        try write("{}", to: root.appendingPathComponent("metadata.json"))
        try write("{}", to: root.appendingPathComponent("real-tokenizer/tokenizer.json"))
        try FileManager.default.createSymbolicLink(
            atPath: root.appendingPathComponent("tokenizer").path,
            withDestinationPath: "real-tokenizer"
        )
        try writeModelDirectory(root.appendingPathComponent("local.aimodel"))

        XCTAssertEqual(
            CoreAILocalResourceContract.resolve(path: root.path).errorCode,
            .unsafePath
        )
    }

    func testContractCasesMatchTheSharedSpec() throws {
        let specURL = try locateSharedSpec()
        let spec = try JSONDecoder().decode(ContractSpec.self, from: Data(contentsOf: specURL))
        XCTAssertEqual(spec.schemaVersion, 1)
        XCTAssertFalse(spec.cases.isEmpty)

        for testCase in spec.cases {
            let root = try makeTemporaryDirectory()
            try materialize(testCase.entries, at: root)
            let selected = testCase.select == "."
                ? root
                : root.appendingPathComponent(testCase.select)
            let resolution = CoreAILocalResourceContract.resolve(path: selected.path)

            switch testCase.expect.outcome {
            case "ready":
                guard let resource = resolution.resource else {
                    XCTFail(
                        "\(testCase.id): expected ready, got \(String(describing: resolution.errorCode?.rawValue))"
                    )
                    continue
                }
                XCTAssertEqual(resource.runtimeKind.rawValue, testCase.expect.runtimeKind, testCase.id)
            case "error":
                XCTAssertEqual(resolution.errorCode?.rawValue, testCase.expect.code, testCase.id)
            default:
                XCTFail("\(testCase.id): unknown expected outcome \(testCase.expect.outcome)")
            }
        }
    }

    private func languageResource() throws -> URL {
        let root = try makeTemporaryDirectory()
        try write("{}", to: root.appendingPathComponent("metadata.json"))
        try write("{}", to: root.appendingPathComponent("tokenizer/tokenizer.json"))
        try writeModelDirectory(root.appendingPathComponent("local.aimodel"))
        return root
    }

    private func writeModelDirectory(_ directory: URL) throws {
        try write("{}", to: directory.appendingPathComponent("metadata.json"))
        try write("hash", to: directory.appendingPathComponent("main.hash"))
        try write("model", to: directory.appendingPathComponent("main.mlirb"))
    }

    private func materialize(_ entries: [SpecEntry], at root: URL) throws {
        for entry in entries {
            let path = root.appendingPathComponent(entry.path)
            switch entry.kind {
            case "dir":
                try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
            case "file":
                try write(entry.contents ?? "fixture", to: path)
            case "symlink":
                guard let target = entry.target else {
                    throw SpecError.missingSymlinkTarget(entry.path)
                }
                try FileManager.default.createDirectory(
                    at: path.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try FileManager.default.createSymbolicLink(
                    atPath: path.path,
                    withDestinationPath: target
                )
            default:
                throw SpecError.unknownEntryKind(entry.kind)
            }
        }
    }

    /// The shared spec lives in the Rust resource tree because Rust reads it with
    /// `include_str!`. The Swift test walks up from this file so CI does not need
    /// an extra path environment variable.
    private func locateSharedSpec() throws -> URL {
        var directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        for _ in 0..<8 {
            let candidate = directory.appendingPathComponent(
                "src-tauri/resources/core-ai/local-model-contract-cases.json"
            )
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            directory = directory.deletingLastPathComponent()
        }
        throw SpecError.specNotFound(#filePath)
    }

    private enum SpecError: Error {
        case specNotFound(String)
        case unknownEntryKind(String)
        case missingSymlinkTarget(String)
    }
}

private struct ContractSpec: Decodable {
    let schemaVersion: Int
    let cases: [ContractCase]
}

private struct ContractCase: Decodable {
    let id: String
    let select: String
    let expect: ExpectedOutcome
    let entries: [SpecEntry]
}

private struct ExpectedOutcome: Decodable {
    let outcome: String
    let code: String?
    let runtimeKind: String?
}

private struct SpecEntry: Decodable {
    let path: String
    let kind: String
    let target: String?
    let contents: String?
}
