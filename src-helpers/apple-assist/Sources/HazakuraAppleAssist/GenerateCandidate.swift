import Foundation
#if !FIXTURE_MODE
import FoundationModels
#endif

// `GenerateCandidate.run` is the single dispatch point for the
// `generate_apple_assist_candidate` request. In fixture mode it
// returns prefix + selected text — the same shape the Rust stub
// produces, so the Rust integration test can be one assertion
// against either side.
//
// Live mode uses Apple Foundation Models and returns only a
// bounded replacement candidate. Applying the edit remains a
// main-window transaction handled by the Tauri app.

enum GenerateCandidate {
    enum RunResult {
        case ok(AppleAssistResponse)
        case error(AppleAssistErrorEnvelope)
    }

    static func run(_ request: AppleAssistRequest) async -> RunResult {
        guard IntentAllowlist.allOperations.contains(request.operation) else {
            return .error(
                AppleAssistErrorEnvelope(
                    error: "Unknown operation: \(request.operation)",
                    kind: "validation"
                )
            )
        }

        guard IntentAllowlist.implementedInV0_12.contains(request.operation) else {
            return .error(
                AppleAssistErrorEnvelope(
                    error: "Operation '\(request.operation)' is deferred in v0.12.",
                    kind: "deferred"
                )
            )
        }

        #if FIXTURE_MODE
        let candidate =
            CandidatePrefix.prefix(for: request.operation) + request.selectedText
        return .ok(
            AppleAssistResponse(
                operation: request.operation,
                candidateText: candidate,
                modelId: CandidatePrefix.fixtureModelId(),
                latencyMs: 0
            )
        )
        #else
        if #available(macOS 26.0, *) {
            let availability = AvailabilityProbe.probe()
            guard availability.kind == "available" else {
                return .error(
                    AppleAssistErrorEnvelope(
                        error: availability.reason ?? "Foundation Models is not available.",
                        kind: "unavailable"
                    )
                )
            }

            let startedAt = Date()
            do {
                let model = SystemLanguageModel.default
                guard model.supportsLocale() else {
                    return .error(
                        AppleAssistErrorEnvelope(
                            error: "Apple Foundation Models does not support the current app language or locale for generation yet: \(Locale.current.identifier)",
                            kind: "unsupported_language"
                        )
                    )
                }
                let session = LanguageModelSession(
                    model: model,
                    instructions: Instructions(liveSystemInstructions)
                )
                let response = try await session.respond(
                    to: Prompt(buildLivePrompt(for: request))
                )
                let candidate = stripOuterMarkdownFence(
                    response.content.trimmingCharacters(in: .whitespacesAndNewlines)
                )
                guard !candidate.isEmpty else {
                    return .error(
                        AppleAssistErrorEnvelope(
                            error: "Foundation Models returned an empty candidate.",
                            kind: "internal"
                        )
                    )
                }
                return .ok(
                    AppleAssistResponse(
                        operation: request.operation,
                        candidateText: candidate,
                        modelId: "apple:foundation-models:system-default",
                        latencyMs: Int(Date().timeIntervalSince(startedAt) * 1_000)
                    )
                )
            } catch {
                return .error(classify(error))
            }
        }
        return .error(
            AppleAssistErrorEnvelope(
                error: "Foundation Models requires macOS 26 or later.",
                kind: "unavailable"
            )
        )
        #endif
    }

    #if !FIXTURE_MODE
    @available(macOS 26.0, *)
    private static let liveSystemInstructions = """
    You are Hazakura Local Assist inside Hazakura Editor. Help revise a user-owned Markdown document.
    Return only the replacement text for the target range. Do not include explanations, labels, bullet summaries, or metadata unless the user explicitly asked for them.
    Preserve Markdown structure, front matter, code fences, links, and the target text language.
    The replacement must use the same language as the target text. If the target text is Japanese, return Japanese.
    If the user asks for a continuation, return the target text plus a natural continuation that can replace the target range.
    Surrounding document context is reference only. Do not copy headings, list items, or wording from surrounding context into the replacement unless that text is already in the target.
    Keep the replacement scoped to the target range; do not rewrite other sections of the document.
    """

    private static func buildLivePrompt(for request: AppleAssistRequest) -> String {
        let instruction = normalizedInstruction(for: request)
        let context = sanitized(
            request.documentContext,
            fallback: "(No surrounding context provided.)"
        )
        return """
        User request:
        \(instruction)

        Operation:
        \(request.operation)

        Output language rule:
        Return the replacement in the same language as the target text.

        Target text to replace:
        ```markdown
        \(request.selectedText)
        ```

        Surrounding document context, for reference only. Do not use this as replacement text:
        ```markdown
        \(context)
        ```

        Return only the replacement text.
        """
    }

    private static func normalizedInstruction(for request: AppleAssistRequest) -> String {
        let raw = sanitized(request.instruction, fallback: "")
        if raw.contains("続き") {
            return "Continue the target text naturally in the same language. Keep the original target text and append the continuation."
        }
        if raw.contains("校正") {
            return "Proofread the target text in the same language. Fix typos, awkward wording, and grammar without changing the meaning."
        }
        if raw.contains("自然") || raw.contains("整え") || raw.contains("章を直し") {
            return "Rewrite the target text more naturally in the same language. Preserve the meaning, tone, Markdown structure, and formatting."
        }
        if !raw.isEmpty {
            return "\(defaultInstruction(for: request.operation)) User request: \(raw)"
        }
        return defaultInstruction(for: request.operation)
    }

    private static func defaultInstruction(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "Summarize the target text in the same language."
        case "proofread":
            return "Proofread the target text in the same language and preserve its intent."
        case "rephrase":
            return "Rewrite the target text naturally in the same language and preserve its intent."
        default:
            return "Revise the target text according to the operation in the same language."
        }
    }

    private static func sanitized(_ value: String?, fallback: String) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return fallback
        }
        return trimmed
    }

    private static func stripOuterMarkdownFence(_ value: String) -> String {
        var lines = value.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.first?.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("```") == true else {
            return value
        }
        lines.removeFirst()
        if lines.last?.trimmingCharacters(in: .whitespacesAndNewlines) == "```" {
            lines.removeLast()
        }
        return lines
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @available(macOS 26.0, *)
    private static func classify(_ error: Error) -> AppleAssistErrorEnvelope {
        if let generationError = error as? LanguageModelSession.GenerationError {
            switch generationError {
            case .exceededContextWindowSize(_):
                return AppleAssistErrorEnvelope(
                    error: "Foundation Models input is too large for this request. Try a smaller selection.",
                    kind: "validation"
                )
            case .assetsUnavailable(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models assets are unavailable.",
                    kind: "unavailable"
                )
            case .guardrailViolation(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models refused this request because it hit a guardrail.",
                    kind: "guardrail"
                )
            case .unsupportedGuide(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models does not support this generation guide yet.",
                    kind: "validation"
                )
            case .unsupportedLanguageOrLocale(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models does not support this language or current locale for generation yet. Try a smaller English sample or check Apple Intelligence language settings.",
                    kind: "unsupported_language"
                )
            case .decodingFailure(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models returned a response that could not be decoded.",
                    kind: "internal"
                )
            case .rateLimited(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models is rate limited. Try again shortly.",
                    kind: "throttled"
                )
            case .concurrentRequests(_):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models is busy with another request. Try again shortly.",
                    kind: "throttled"
                )
            case .refusal(_, _):
                return AppleAssistErrorEnvelope(
                    error: "Apple Foundation Models refused this request.",
                    kind: "guardrail"
                )
            @unknown default:
                break
            }
        }
        let description = String(describing: error)
        let lowercased = description.lowercased()
        let kind: String
        if lowercased.contains("unsupportedlanguageorlocale") {
            kind = "unsupported_language"
        } else if lowercased.contains("guardrail") || lowercased.contains("refus") {
            kind = "guardrail"
        } else if lowercased.contains("rate") || lowercased.contains("concurrent") {
            kind = "throttled"
        } else if lowercased.contains("context") {
            kind = "validation"
        } else {
            kind = "internal"
        }
        return AppleAssistErrorEnvelope(
            error: "Foundation Models generation failed.",
            kind: kind
        )
    }
    #endif
}
