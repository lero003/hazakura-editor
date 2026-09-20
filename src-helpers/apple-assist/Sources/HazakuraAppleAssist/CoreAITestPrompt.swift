import Foundation

/// The tiny Qwen fixture tends to echo long sentinel markers. Keep the System
/// prompt unchanged and give only this Developer test backend a compact prompt
/// whose output can still pass Hazakura's existing proposal safety checks.
enum CoreAITestPrompt {
    static func build(for request: AppleAssistRequest) -> String {
        let visibleRequest = firstNonBlank(
            request.additionalRequest,
            request.instruction
        ) ?? defaultInstruction(for: request.operation)
        let context = trimmed(request.documentContext)
        let contextSection = context.map { "\n参考文脈（書き換えない）:\n\($0)\n" } ?? ""
        return """
        依頼:
        \(visibleRequest)

        書き換える本文:
        \(request.selectedText)
        \(contextSection)
        書き換え後の本文だけを返してください。説明、見出し、引用符は不要です。
        /no_think
        """
    }

    private static func defaultInstruction(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "本文を短く要約してください。新しい情報は足さないでください。"
        case "proofread":
            return "誤字脱字、文法ミス、表記ゆれだけ直してください。"
        default:
            return "意味を変えずに、読みやすくしてください。"
        }
    }

    private static func firstNonBlank(_ values: String?...) -> String? {
        values.compactMap(trimmed).first
    }

    private static func trimmed(_ value: String?) -> String? {
        let text = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }
}
