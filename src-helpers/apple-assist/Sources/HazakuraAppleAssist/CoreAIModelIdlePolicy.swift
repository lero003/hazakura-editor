import Foundation

/// Idle-lifetime contract for the cached production Core AI model.
///
/// Deliberately free of Core AI types so the lifetime rules can be tested
/// without loading a model.
enum CoreAIModelIdlePolicy {
    /// Documented default when `HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS` is unset.
    static let defaultIdleReleaseSeconds: Double = 300

    /// Largest value that can be converted to nanoseconds without overflowing
    /// `UInt64` (about 584 years). Anything above it cannot be used by the timer.
    static let maximumIdleReleaseSeconds: Double = Double(UInt64.max) / 1_000_000_000

    /// `nil` means "keep the model for the helper's lifetime" and is selected
    /// only by an explicit `0`. An unset, empty, unparsable, non-finite, or
    /// negative value — and any value the release timer cannot represent — falls
    /// back to the default so a typo cannot silently pin the weights on a small
    /// machine or crash the helper.
    static func idleReleaseSeconds(from raw: String?) -> Double? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return defaultIdleReleaseSeconds
        }
        // `1e-999` parses to 0 without being an explicit zero request, so match
        // the literal form instead of the parsed value.
        if isExplicitZero(raw) {
            return nil
        }
        guard let seconds = Double(raw),
              seconds.isFinite,
              seconds > 0,
              seconds <= maximumIdleReleaseSeconds else {
            return defaultIdleReleaseSeconds
        }
        return seconds
    }

    /// True only for a literal zero (`0`, `0.0`, `+0.00`). A negative zero or an
    /// underflowed value such as `1e-999` is a typo, not an explicit request to
    /// keep the model forever.
    private static func isExplicitZero(_ raw: String) -> Bool {
        let body = raw.hasPrefix("+") ? String(raw.dropFirst()) : raw
        guard !body.isEmpty else { return false }
        let components = body.split(separator: ".", omittingEmptySubsequences: false)
        guard components.count <= 2 else { return false }
        return components.allSatisfy { component in
            component.allSatisfy { $0 == "0" }
        }
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
