import XCTest

#if canImport(CoreAIKit) && canImport(FoundationModels)
import CoreAIKit
import FoundationModels

@available(macOS 27.0, *)
final class CoreAIConversationProbeTests: XCTestCase {
    func testE4BDirectConversation() async throws {
        guard let path = ProcessInfo.processInfo.environment["HAZAKURA_DIRECT_CHAT_E4B_ROOT"] else {
            throw XCTSkip("Set HAZAKURA_DIRECT_CHAT_E4B_ROOT to a local E4B v2 resource root")
        }
        let root = URL(fileURLWithPath: path, isDirectory: true)
        let model = try await KitGemmaModel(
            decoderBundleAt: root.appendingPathComponent("decoder", isDirectory: true),
            tablesAt: root.appendingPathComponent("tables", isDirectory: true),
            modelID: "direct-chat-e4b-v2",
            pleMode: .perTokenProvider
        )
        try await converse(with: model, label: "E4B v2")
    }

    func test12BDirectConversation() async throws {
        guard let path = ProcessInfo.processInfo.environment["HAZAKURA_DIRECT_CHAT_12B_BUNDLE"] else {
            throw XCTSkip("Set HAZAKURA_DIRECT_CHAT_12B_BUNDLE to a local 12B language bundle")
        }
        let model = try await KitLanguageModel(
            bundleAt: URL(fileURLWithPath: path, isDirectory: true),
            engineVariant: .pipelined,
            modelID: "direct-chat-12b-v1"
        )
        try await converse(with: model, label: "12B")
    }

    private func converse<Model: LanguageModel>(with model: Model, label: String) async throws {
        let session = LanguageModelSession(model: model)
        let options = GenerationOptions(
            samplingMode: .greedy,
            temperature: nil,
            maximumResponseTokens: 160
        )
        let prompts = [
            "こんにちは。今日は何を手伝えますか。日本語で二文だけ答えてください。",
            "私の合言葉は『青い栞』です。覚えて、返事は短くしてください。",
            "さっき伝えた合言葉は何でしたか。前置きなしで答えてください。",
            "雨がやんだ図書館を舞台に、自然な日本語で二文だけ書いてください。",
        ]
        for (index, prompt) in prompts.enumerated() {
            let response = try await session.respond(to: Prompt(prompt), options: options)
            let answer = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
            XCTAssertFalse(answer.isEmpty, "\(label) turn \(index + 1) returned no text")
            if index == 2 {
                XCTAssertTrue(answer.contains("青い栞"), "\(label) did not recall the prior turn")
            }
            print("DIRECT_CHAT \(label) turn \(index + 1)\nPROMPT: \(prompt)\nRESPONSE: \(answer)")
        }
    }
}
#endif
