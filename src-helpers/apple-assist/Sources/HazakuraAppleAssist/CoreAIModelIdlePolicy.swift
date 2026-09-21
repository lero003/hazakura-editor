import Foundation

/// Idle-lifetime contract for the cached production Core AI model.
///
/// Deliberately free of Core AI types so the lifetime rules can be tested
/// without loading a model.
enum CoreAIModelIdlePolicy {
    /// Documented default when `HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS` is unset.
    static let defaultIdleReleaseSeconds: Double = 300

    /// `nil` means "keep the model for the helper's lifetime" and is selected
    /// only by an explicit `0`. An unset, empty, unparsable, non-finite, or
    /// negative value falls back to the default so a typo cannot silently pin
    /// the weights on a small machine.
    static func idleReleaseSeconds(from raw: String?) -> Double? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return defaultIdleReleaseSeconds
        }
        guard let seconds = Double(raw), seconds.isFinite, seconds >= 0 else {
            return defaultIdleReleaseSeconds
        }
        return seconds == 0 ? nil : seconds
    }
}

/// Generation-token tracker for a scheduled release. Scheduling again (a new
/// request arrived) invalidates every earlier token, so the pending release is
/// skipped instead of dropping a model that is in use.
struct CoreAIModelIdleTracker {
    private(set) var generation = 0

    mutating func schedule() -> Int {
        generation += 1
        return generation
    }

    func isCurrent(_ token: Int) -> Bool {
        token == generation
    }
}
