import XCTest
@testable import HazakuraAppleAssist

final class GenerationContractTests: XCTestCase {
    func testBackendResolverDistinguishesSystemAndCoreAITest() {
        guard case .systemDefault = AssistBackend.resolve(wireValue: "system_default", modelId: nil) else {
            return XCTFail("system_default must resolve to the System backend")
        }
        guard case .coreAITest = AssistBackend.resolve(wireValue: "core_ai_test", modelId: nil) else {
            return XCTFail("core_ai_test must resolve to the fixed Developer test backend")
        }
        guard case .coreAI(let modelId) = AssistBackend.resolve(
            wireValue: "core_ai",
            modelId: "apple:core-ai:writing-primary"
        ) else {
            return XCTFail("core_ai must resolve only with native model provenance")
        }
        XCTAssertEqual(modelId, "apple:core-ai:writing-primary")
        XCTAssertNil(AssistBackend.resolve(wireValue: "core_ai", modelId: nil))
        XCTAssertNil(AssistBackend.resolve(wireValue: "core_ai", modelId: "https://example.com/model"))
        XCTAssertEqual(AssistBackend.coreAITest.modelId, "apple:core-ai:qwen3-0.6b-test")
    }

    func testBackendResolverAcceptsOnlyAppManagedLocalIdentityForLocalCoreAI() {
        guard case .coreAILocal(let modelId) = AssistBackend.resolve(
            wireValue: "core_ai_local",
            modelId: "local:app-managed:My Qwen"
        ) else {
            return XCTFail("core_ai_local must resolve an app-managed local identity")
        }
        XCTAssertEqual(modelId, "local:app-managed:My Qwen")
        XCTAssertEqual(AssistBackend.coreAILocal(modelId: modelId).modelId, modelId)
        XCTAssertNil(AssistBackend.resolve(wireValue: "core_ai_local", modelId: nil))
        XCTAssertNil(AssistBackend.resolve(
            wireValue: "core_ai_local",
            modelId: "apple:core-ai:writing-primary"
        ))
        XCTAssertNil(AssistBackend.resolve(
            wireValue: "core_ai_local",
            modelId: "local:app-managed:bad\nidentity"
        ))
    }

    func testLegacyRequestAndResponseOmitUsage() throws {
        let request = try JSONDecoder().decode(AppleAssistRequest.self, from: Data("{\"operation\":\"proofread\",\"selectedText\":\"text\"}".utf8))
        XCTAssertNil(request.measureUsage)
        let response = AppleAssistResponse(operation: "proofread", candidateText: "text", modelId: "fixture", latencyMs: 0)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(response)) as? [String: Any])
        XCTAssertEqual(Set(object.keys), ["operation", "candidateText", "modelId", "latencyMs"])
    }

    func testCoreAITestPromptDoesNotExposeProposalBoundaryMarkers() {
        let request = AppleAssistRequest(
            operation: "proofread",
            actionId: "proofread_only",
            selectedText: "今日は良い天気でず。",
            documentContext: "前後の文脈",
            instruction: nil,
            additionalRequest: "誤字だけを直してください。"
        )
        let prompt = CoreAITestPrompt.build(for: request)
        XCTAssertFalse(prompt.contains("HAZAKURA_TEXT"))
        XCTAssertFalse(prompt.contains("HAZAKURA_CONTEXT"))
        XCTAssertTrue(prompt.contains(request.selectedText))
        XCTAssertTrue(prompt.hasSuffix("/no_think"))
    }
    func testBothGenerationPathsRefuseUnknownAndDeferredOperationsWithoutPartials() async {
        for (operation, expected) in [("unknown", "validation"), ("extract", "deferred")] {
            let request = AppleAssistRequest(operation: operation, actionId: nil, selectedText: "text", documentContext: nil, instruction: nil, additionalRequest: nil)
            let ordinary = await GenerateCandidate.run(request, backend: .systemDefault)
            var emitted = false
            let streaming = await GenerateCandidate.runStreaming(request, backend: .systemDefault, onPartial: { _ in emitted = true })
            guard case .error(let first) = ordinary, case .error(let second) = streaming else {
                XCTFail("Refused operations must never create candidates")
                continue
            }
            XCTAssertEqual(first.kind, expected)
            XCTAssertEqual(second.kind, expected)
            XCTAssertEqual(first.error, second.error)
            XCTAssertFalse(emitted)
        }
    }
}
