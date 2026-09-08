import XCTest
@testable import HazakuraAppleAssist

final class GenerationContractTests: XCTestCase {
    func testLegacyRequestAndResponseOmitUsage() throws {
        let request = try JSONDecoder().decode(AppleAssistRequest.self, from: Data("{\"operation\":\"proofread\",\"selectedText\":\"text\"}".utf8))
        XCTAssertNil(request.measureUsage)
        let response = AppleAssistResponse(operation: "proofread", candidateText: "text", modelId: "fixture", latencyMs: 0)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(response)) as? [String: Any])
        XCTAssertEqual(Set(object.keys), ["operation", "candidateText", "modelId", "latencyMs"])
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
