import Foundation

/// Hazakura's requested Core AI generation settings next to what the pinned
/// engine actually receives.
///
/// Both halves travel in the response `usage` so a requested-but-unsupported
/// setting is visible instead of being silently dropped. The pinned
/// `coreai-kit` executors (`KitGemmaExecutor` for E4B, `KitExecutor` for 12B,
/// revision bebe09a0) build their sampler from `GenerationOptions.temperature`
/// alone:
///
///     request.generationOptions.temperature.map { SamplingConfiguration(temperature: $0) } ?? .greedy
///
/// `GenerationOptions.samplingMode` (top-k / top-p) never reaches this engine,
/// so Hazakura requests no sampling mode and reports the engine's own defaults.
struct CoreAIGenerationProfile: Equatable {
    let maximumResponseTokens: Int
    /// `nil` selects the engine's greedy (argmax) sampler. `0` is greedy too,
    /// but the Developer fixture keeps the literal value it was measured with.
    let temperature: Double?
    /// Top-k / top-p requests are dropped by the pinned engine. Recorded so a
    /// future request cannot be lost without a trace.
    let topK: Int?
    let topP: Double?

    /// Production Core AI models follow the System contract: a paragraph or a
    /// whole section rewrite easily exceeds the old Developer fixture cap of 128.
    static let production = CoreAIGenerationProfile(
        maximumResponseTokens: 2048,
        temperature: nil,
        topK: nil,
        topP: nil
    )

    /// The Developer fixture stays deterministic and short.
    static let developerFixture = CoreAIGenerationProfile(
        maximumResponseTokens: 128,
        temperature: 0,
        topK: nil,
        topP: nil
    )

    /// What Hazakura asked for.
    var samplingRequested: String {
        var parts = ["temperature=\(temperature.map(Self.number) ?? "none(greedy)")"]
        if let topK { parts.append("topK=\(topK)") }
        if let topP { parts.append("topP=\(Self.number(topP))") }
        return parts.joined(separator: ", ")
    }

    /// What the pinned engine applies, including anything it drops.
    var samplingEffective: String {
        var parts: [String] = []
        if let temperature, temperature > 0 {
            parts.append("temperature=\(Self.number(temperature))")
            parts.append("engine-default topK, no topP")
        } else {
            parts.append("greedy")
        }
        var dropped: [String] = []
        if let topK { dropped.append("topK=\(topK)") }
        if let topP { dropped.append("topP=\(Self.number(topP))") }
        if !dropped.isEmpty {
            parts.append("dropped by engine: \(dropped.joined(separator: ", "))")
        }
        return parts.joined(separator: ", ")
    }

    private static func number(_ value: Double) -> String {
        value == value.rounded() && abs(value) < 1_000
            ? String(Int(value))
            : String(value)
    }
}
