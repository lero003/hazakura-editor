import XCTest
@testable import HazakuraAppleAssist

final class CoreAIGenerationProfileTests: XCTestCase {
    func testProductionProfileRequestsGreedyAndTheRaisedCap() {
        let profile = CoreAIGenerationProfile.production
        XCTAssertEqual(profile.maximumResponseTokens, 2048)
        XCTAssertNil(profile.temperature)
        XCTAssertEqual(profile.samplingRequested, "temperature=none(greedy)")
        XCTAssertEqual(profile.samplingEffective, "greedy")
    }

    func testDeveloperFixtureProfileStaysDeterministicAndShort() {
        let profile = CoreAIGenerationProfile.developerFixture
        XCTAssertEqual(profile.maximumResponseTokens, 128)
        XCTAssertEqual(profile.samplingRequested, "temperature=0")
        XCTAssertEqual(profile.samplingEffective, "greedy")
    }

    func testUnsupportedSamplingModesAreReportedAsDropped() {
        let profile = CoreAIGenerationProfile(
            maximumResponseTokens: 2048,
            temperature: 0.7,
            topK: 64,
            topP: 0.95
        )
        XCTAssertEqual(profile.samplingRequested, "temperature=0.7, topK=64, topP=0.95")
        XCTAssertTrue(profile.samplingEffective.contains("temperature=0.7"))
        XCTAssertTrue(profile.samplingEffective.contains("dropped by engine: topK=64, topP=0.95"))
    }
}
