import Foundation

/// The Local Assist prompt contract shared by the live System and Core AI paths.
///
/// The operation's base instruction and the user's additional request are
/// separate slots: an additional request refines the operation instead of
/// replacing its rules. Before this split, adding "もう少し丁寧に" to 校正だけ
/// dropped the proofreading rules entirely, because the additional request
/// became the whole visible request.
///
/// The Developer-only Qwen fixture keeps its own compact prompt
/// (`CoreAITestPrompt`); this contract is what the shipping models receive.
enum AssistPrompt {
    static func buildLive(for request: AppleAssistRequest) -> String {
        let additional = additionalRequest(for: request) ?? "(追加のご要望はありません)"
        let context = trimmed(request.documentContext) ?? "(前後の文脈はありません)"
        return """
        基本操作:
        \(baseInstruction(for: request))

        変更の範囲:
        \(scopeRules(for: request))

        追加のご要望:
        \(additional)

        対象本文（ここだけを書き換える）:
        <<<HAZAKURA_TEXT_START
        \(request.selectedText)
        HAZAKURA_TEXT_END>>>

        参考文脈（書き換え対象ではありません）:
        <<<HAZAKURA_CONTEXT_START
        \(context)
        HAZAKURA_CONTEXT_END>>>
        """
    }

    /// What the operation is. Always present, even when the user adds a request.
    static func baseInstruction(for request: AppleAssistRequest) -> String {
        baseInstruction(forActionId: resolvedActionId(for: request), operation: request.operation)
    }

    static func baseInstruction(forActionId actionId: String, operation: String) -> String {
        switch actionId {
        case "proofread_only":
            return "誤字脱字、助詞、文法ミス、明らかな表記ゆれだけを直してください。"
                + "修正箇所がなければ、対象本文を一字一句そのまま返してください。"
        case "rewrite_natural":
            return "意味を変えずに、読みやすい自然な文にしてください。"
        case "shorten":
            return "意味を保ったまま短くしてください。"
        case "summarize":
            return "本文を3〜5行で要約してください。"
        case "translate":
            return "本文を翻訳してください。"
        case "continue_ideas":
            return "本文に自然に続く文章を書いてください。"
        case "review_section":
            return "読みにくい箇所、重複、流れを直してください。"
        default:
            return defaultInstruction(for: operation)
        }
    }

    /// What may change and what must not. Kept per operation: a proofreading
    /// pass and a summary need different preservation rules.
    static func scopeRules(for request: AppleAssistRequest) -> String {
        scopeRules(forActionId: resolvedActionId(for: request), operation: request.operation)
    }

    static func scopeRules(forActionId actionId: String, operation: String) -> String {
        switch actionId {
        case "proofread_only":
            return "変えてよい: 誤字脱字、助詞、文法ミス、表記ゆれ。"
                + "\n変えない: 意味、文体、数値、固有名詞、見出し、リンク、コード、引用、表。"
                + "\n表記を保つ: 漢数字と算用数字、半角と全角、句読点を相互に置き換えない。"
                + "\n空白と改行も、修正に必要な箇所以外は保つ。"
        case "rewrite_natural":
            return "変えてよい: 語順、語彙、文の区切り。"
                + "\n変えない: 出来事、事実、数値、固有名詞、否定、条件、例外、見出し、リンク、コード、引用。"
                + "\nMarkdownの引用ブロック（> で始まる行）は記号と本文を一字一句保ち、説明文だけ直す。"
        case "shorten":
            return "変えてよい: 冗長な言い回しの削除、文の統合。"
                + "\n変えない: 意味、事実、数値、固有名詞、条件、例外、リンク、コード、引用。"
        case "summarize":
            return "変えてよい: 構成の組み替え、重複の統合。"
                + "\n変えない: 事実、数値、固有名詞、条件、例外。新しい情報は足さない。"
        case "translate":
            return "変えてよい: 文体、語順、引用文の翻訳。"
                + "\n変えない: 数値、固有名詞、リンクのURL、コードブロック、フロントマター。"
        case "continue_ideas":
            return "変えてよい: これから足す文章だけ。"
                + "\n変えない: 既存の本文、文体、話の方向性。"
        case "review_section":
            return "変えてよい: 文の接続、段落の並び、重複の削除。"
                + "\n変えない: 意味、事実、数値、固有名詞、見出しの階層、リンク、コード、引用。"
        default:
            return defaultScopeRules(for: operation)
        }
    }

    /// The user's own request, kept out of the base instruction. `instruction`
    /// is the legacy field for callers that predate `additionalRequest`.
    static func additionalRequest(for request: AppleAssistRequest) -> String? {
        firstNonBlank(request.additionalRequest, request.instruction)
    }

    static func resolvedActionId(for request: AppleAssistRequest) -> String {
        sanitized(request.actionId, fallback: fallbackActionId(for: request.operation))
    }

    static func fallbackActionId(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "summarize"
        case "proofread":
            return "proofread_only"
        default:
            return "rewrite_natural"
        }
    }

    private static func defaultInstruction(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "本文を短く要約してください。新しい情報は足さないでください。"
        case "proofread":
            return "誤字脱字、助詞、文法ミス、明らかな表記ゆれだけを直してください。"
                + "修正箇所がなければ、対象本文を一字一句そのまま返してください。"
        case "rephrase":
            return "意味を変えずに、読みやすくしてください。"
        default:
            return "依頼に沿って本文を直してください。"
        }
    }

    private static func defaultScopeRules(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "変えてよい: 構成の組み替え。"
                + "\n変えない: 事実、数値、固有名詞、条件、例外。"
        case "proofread":
            return "変えてよい: 誤字脱字、助詞、文法ミス、表記ゆれ。"
                + "\n変えない: 意味、文体、数値、固有名詞。"
                + "\n表記を保つ: 漢数字と算用数字、半角と全角、句読点を相互に置き換えない。"
                + "\n空白と改行も、修正に必要な箇所以外は保つ。"
        default:
            return "変えてよい: 語順、語彙、文の区切り。"
                + "\n変えない: 出来事、事実、数値、固有名詞、否定、条件、例外。"
        }
    }

    private static func sanitized(_ value: String?, fallback: String) -> String {
        trimmed(value) ?? fallback
    }

    private static func firstNonBlank(_ values: String?...) -> String? {
        values.compactMap(trimmed).first
    }

    private static func trimmed(_ value: String?) -> String? {
        let text = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }
}
