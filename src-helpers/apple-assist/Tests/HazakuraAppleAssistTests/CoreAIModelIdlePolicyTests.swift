import XCTest
@testable import HazakuraAppleAssist

/// The idle lifetime rules are pure logic: unset means the documented default,
/// and only an explicit zero keeps the model for the helper's lifetime.
final class CoreAIModelIdlePolicyTests: XCTestCase {
    func testUnsetOrInvalidValuesUseTheDocumentedDefault() {
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: nil), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: ""), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "   "), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "abc"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "-5"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "nan"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "inf"), 300)
    }

    func testOnlyAnExplicitZeroKeepsTheModelForTheHelperLifetime() {
        XCTAssertNil(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "0"))
        XCTAssertNil(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "0.0"))
        XCTAssertNil(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "+0.00"))
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "300"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "2.5"), 2.5)
    }

    /// An underflowed or overflowing value is a typo, not an instruction: it must
    /// neither disable the timer nor crash the nanosecond conversion.
    func testValuesTheTimerCannotRepresentFallBackToTheDefault() {
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "1e100"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "1e-999"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "-1e-999"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "-0"), 300)
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseSeconds(from: "1e400"),
            CoreAIModelIdlePolicy.defaultIdleReleaseSeconds
        )
    }

    func testLargestRepresentableValueIsAcceptedAndAnythingAboveIsNot() {
        let maximum = CoreAIModelIdlePolicy.maximumIdleReleaseSeconds
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseSeconds(from: String(maximum)),
            maximum
        )
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseSeconds(from: String(maximum * 2)),
            CoreAIModelIdlePolicy.defaultIdleReleaseSeconds
        )
    }

    /// The boundary must survive the real nanosecond conversion, not just the
    /// Double comparison: `Double(UInt64.max)` rounds up, so an off-by-a-bit
    /// bound would trap here instead of returning a value.
    func testAcceptedValuesAlwaysConvertToNanoseconds() {
        let maximum = CoreAIModelIdlePolicy.maximumIdleReleaseSeconds
        XCTAssertNotNil(CoreAIModelIdlePolicy.idleReleaseNanoseconds(from: String(maximum)))
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseNanoseconds(from: String(maximum * 2)),
            300 * 1_000_000_000
        )
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseNanoseconds(from: "1e100"),
            300 * 1_000_000_000
        )
        XCTAssertEqual(
            CoreAIModelIdlePolicy.idleReleaseNanoseconds(from: "2.5"),
            2_500_000_000
        )
        XCTAssertNil(CoreAIModelIdlePolicy.idleReleaseNanoseconds(from: "0"))
    }

    func testReschedulingInvalidatesTheEarlierReleaseToken() {
        var tracker = CoreAIModelIdleTracker()
        let first = tracker.schedule()
        XCTAssertTrue(tracker.isCurrent(first))

        // A request that arrives while the timer runs extends the lifetime.
        let second = tracker.schedule()
        XCTAssertFalse(tracker.isCurrent(first))
        XCTAssertTrue(tracker.isCurrent(second))
        XCTAssertFalse(tracker.isCurrent(second + 1))
    }
}
