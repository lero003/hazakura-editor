import Foundation

/// Idle-lifetime contract for the cached production Core AI model.
///
/// Deliberately free of Core AI types so the lifetime rules can be tested
/// without loading a model.
enum CoreAIModelIdlePolicy {
    /// Documented default when `HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS` is unset.
    static let defaultIdleReleaseSeconds: Double = 300

    /// Largest whole second that can be converted to nanoseconds without
    /// overflowing `UInt64` (about 584 years). Dividing in integer space first
    /// matters: `Double(UInt64.max)` rounds up to 2^64, so using it as the
    /// bound would let a boundary value overflow the nanosecond conversion.
    static let maximumIdleReleaseSeconds: Double = Double(UInt64.max / 1_000_000_000)

    /// Nanoseconds for a validated value, or `nil` when there is no timer.
    /// `UInt64(exactly:)` keeps the conversion total: an unexpected value can
    /// never trap the helper.
    static func idleReleaseNanoseconds(from raw: String?) -> UInt64? {
        guard let seconds = idleReleaseSeconds(from: raw) else { return nil }
        return nanoseconds(forSeconds: seconds)
    }

    static func nanoseconds(forSeconds seconds: Double) -> UInt64? {
        UInt64(exactly: (seconds * 1_000_000_000).rounded())
    }

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
        // Splitting `.` yields empty components, and `allSatisfy` accepts an
        // empty sequence, so a separator-only literal would otherwise read as
        // "every character is a zero". Require at least one digit.
        guard body.contains("0") else { return false }
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
