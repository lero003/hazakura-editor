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
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "300"), 300)
        XCTAssertEqual(CoreAIModelIdlePolicy.idleReleaseSeconds(from: "2.5"), 2.5)
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
