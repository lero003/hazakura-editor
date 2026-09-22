import XCTest
@testable import HazakuraAppleAssist

final class ProofreadCandidateProtectionTests: XCTestCase {
    private func request(
        operation: String = "proofread",
        actionId: String? = "proofread_only",
        selectedText: String
    ) -> AppleAssistRequest {
        AppleAssistRequest(
            operation: operation,
            actionId: actionId,
            selectedText: selectedText,
            documentContext: nil,
            instruction: nil,
            additionalRequest: nil
        )
    }

    func testProofreadFallsBackToOriginalWhenJapaneseNumeralsAreNormalized() {
        let original = "会議は九月十八日です。資料は三部です。"
        let value = request(selectedText: original)
        let candidate = "会議は9月18日です。資料は3部です。"

        XCTAssertNil(ProofreadCandidateProtection.partialCandidate(candidate, for: value))
        XCTAssertEqual(
            ProofreadCandidateProtection.finalCandidate(candidate, for: value),
            original
        )
    }

    func testProofreadAcceptsTextFixWhenNumberRepresentationIsPreserved() {
        let original = "会議は九月十八日でず。資料は三部です。"
        let value = request(selectedText: original)
        let candidate = "会議は九月十八日です。資料は三部です。"

        XCTAssertEqual(
            ProofreadCandidateProtection.partialCandidate(candidate, for: value),
            candidate
        )
        XCTAssertEqual(
            ProofreadCandidateProtection.finalCandidate(candidate, for: value),
            candidate
        )
    }

    func testProofreadFallbackActionIsAlsoProtected() {
        let original = "二〇二六年に五冊読む。"
        let value = request(actionId: nil, selectedText: original)

        XCTAssertEqual(
            ProofreadCandidateProtection.finalCandidate("2026年に5冊読む。", for: value),
            original
        )
    }

    func testRewriteMayChangeNumberRepresentation() {
        let original = "二〇二六年に五冊読む。"
        let value = request(
            operation: "rephrase",
            actionId: "rewrite_natural",
            selectedText: original
        )
        let candidate = "2026年に5冊読みます。"

        XCTAssertEqual(
            ProofreadCandidateProtection.finalCandidate(candidate, for: value),
            candidate
        )
    }
}
