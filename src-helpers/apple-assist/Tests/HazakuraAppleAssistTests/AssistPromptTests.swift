import XCTest
@testable import HazakuraAppleAssist

final class AssistPromptTests: XCTestCase {
    private func request(
        operation: String = "proofread",
        actionId: String? = "proofread_only",
        selectedText: String = "今日は良い天気でず。",
        documentContext: String? = "前後の文脈",
        instruction: String? = nil,
        additionalRequest: String? = nil
    ) -> AppleAssistRequest {
        AppleAssistRequest(
            operation: operation,
            actionId: actionId,
            selectedText: selectedText,
            documentContext: documentContext,
            instruction: instruction,
            additionalRequest: additionalRequest
        )
    }

    func testAdditionalRequestRefinesTheOperationInsteadOfReplacingIt() {
        let prompt = AssistPrompt.buildLive(for: request(additionalRequest: "もっと丁寧な言い方にしてください。"))
        XCTAssertTrue(prompt.contains("基本操作:\n誤字脱字、助詞、文法ミス、表記ゆれだけを直してください。"))
        XCTAssertTrue(prompt.contains("追加のご要望:\nもっと丁寧な言い方にしてください。"))
        // The keep rules survive an additional request.
        XCTAssertTrue(prompt.contains("変えない: 意味、文体、数値、固有名詞、見出し、リンク、コード、引用、表。"))
    }

    func testWithoutAnAdditionalRequestTheSlotSaysSo() {
        let prompt = AssistPrompt.buildLive(for: request())
        XCTAssertTrue(prompt.contains("追加のご要望:\n(追加のご要望はありません)"))
        XCTAssertTrue(prompt.contains("基本操作:\n誤字脱字"))
    }

    func testLegacyInstructionFieldStillFeedsTheAdditionalRequest() {
        let prompt = AssistPrompt.buildLive(for: request(instruction: "一文ずつ区切ってください。"))
        XCTAssertTrue(prompt.contains("追加のご要望:\n一文ずつ区切ってください。"))
    }

    func testKeepsTheProposalBoundaryMarkersAndTheSelectedText() {
        let prompt = AssistPrompt.buildLive(for: request(selectedText: "本文です。"))
        XCTAssertTrue(prompt.contains("<<<HAZAKURA_TEXT_START\n本文です。\nHAZAKURA_TEXT_END>>>"))
        XCTAssertTrue(prompt.contains("<<<HAZAKURA_CONTEXT_START\n前後の文脈\nHAZAKURA_CONTEXT_END>>>"))
    }

    func testMissingContextIsLabelledInsteadOfLeftBlank() {
        let prompt = AssistPrompt.buildLive(for: request(documentContext: nil))
        XCTAssertTrue(prompt.contains("(前後の文脈はありません)"))
    }

    func testScopeRulesDifferPerAction() {
        let proofread = AssistPrompt.scopeRules(forActionId: "proofread_only", operation: "proofread")
        let summarize = AssistPrompt.scopeRules(forActionId: "summarize", operation: "summarize")
        XCTAssertNotEqual(proofread, summarize)
        XCTAssertTrue(proofread.contains("表記ゆれ"))
        XCTAssertTrue(summarize.contains("新しい情報は足さない"))
    }

    func testMissingActionIdFallsBackToTheOperationTemplate() {
        let proofread = AssistPrompt.buildLive(for: request(operation: "proofread", actionId: nil))
        XCTAssertTrue(proofread.contains("誤字脱字、助詞、文法ミス、表記ゆれだけを直してください。"))
        let summarize = AssistPrompt.buildLive(for: request(operation: "summarize", actionId: nil))
        XCTAssertTrue(summarize.contains("本文を3〜5行で要約してください。"))
    }
}
