import Foundation
import Testing
@testable import HazakuraNextLayoutProbe

@MainActor
struct LayoutProbeCommandTests {
    @Test func acceptsOnlyMeasure() {
        #expect(LayoutProbeCommand.accepts(["--measure"]))
    }

    @Test(arguments: [[], ["measure"], ["--Measure"], ["--measure "], ["--help"],
                      ["--measure=true"], ["--measure", "--measure"], ["--measure", "--"],
                      ["--measure", "原稿の入力"], ["--measure", "/not/an/input"],
                      ["--measure", "--trials=1"], ["/not/an/input"]])
    func rejectsEveryOtherForm(_ arguments: [String]) {
        #expect(LayoutProbeCommand.accepts(arguments) == false)
    }

    @Test func fixedFixtureHasLongJapaneseLinesAndAnExplicitEnd() {
        let source = LayoutProbeCommand.fixture
        let lines = source.split(separator: "\n", omittingEmptySubsequences: false)
        #expect(LayoutProbeCommand.trialCount == 5)
        #expect(source.utf8.count == 387_285)
        #expect(lines.count == 193)
        #expect(lines.dropLast().allSatisfy { $0.utf8.count == 2_016 && $0.hasPrefix("春の川辺で、") })
        #expect(lines.last == "合成原稿の終点")
    }

    @Test func completeRunEncodesOnlyOrderedSamplesAndPerPhaseAggregates() throws {
        let expectedSamples: [[String: Int64]] = [
            ["initialViewportMicroseconds": 30, "narrowViewportMicroseconds": 4, "endViewportMicroseconds": 100],
            ["initialViewportMicroseconds": 10, "narrowViewportMicroseconds": 9, "endViewportMicroseconds": 400],
            ["initialViewportMicroseconds": 50, "narrowViewportMicroseconds": 1, "endViewportMicroseconds": 200],
            ["initialViewportMicroseconds": 20, "narrowViewportMicroseconds": 8, "endViewportMicroseconds": 500],
            ["initialViewportMicroseconds": 40, "narrowViewportMicroseconds": 0, "endViewportMicroseconds": 300],
        ]
        var sources: [String] = []
        let result = LayoutProbeCommand.measure { source in
            let index = sources.count
            sources.append(source)
            guard expectedSamples.indices.contains(index) else { return nil }
            let expected = expectedSamples[index]
            guard let initial = expected["initialViewportMicroseconds"],
                  let narrow = expected["narrowViewportMicroseconds"],
                  let end = expected["endViewportMicroseconds"] else { return nil }
            return .init(initialViewportMicroseconds: initial,
                         narrowViewportMicroseconds: narrow,
                         endViewportMicroseconds: end)
        }

        #expect(sources == Array(repeating: LayoutProbeCommand.fixture, count: 5))
        let report = try #require(result)
        let line = try report.jsonLine()
        #expect(line.contains(where: \.isNewline) == false)
        let object = try JSONSerialization.jsonObject(with: Data(line.utf8))
        let json = try #require(object as? [String: Any])
        #expect(Set(json.keys) == ["fixtureID", "sourceUTF8Bytes", "samples", "aggregates"])
        #expect(json["fixtureID"] as? String == "ja-long-lines-v1")
        #expect(json["sourceUTF8Bytes"] as? Int == LayoutProbeCommand.fixture.utf8.count)
        #expect(json["samples"] as? [[String: Int64]] == expectedSamples)
        let expectedAggregates: [String: [String: Int64]] = [
            "initialViewportMicroseconds": ["min": 10, "median": 30, "max": 50],
            "narrowViewportMicroseconds": ["min": 0, "median": 4, "max": 9],
            "endViewportMicroseconds": ["min": 100, "median": 300, "max": 500],
        ]
        #expect(json["aggregates"] as? [String: [String: Int64]] == expectedAggregates)
        #expect(line.contains("春の川辺で、") == false)
        #expect(line.contains("合成原稿の終点") == false)
        let sorted = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        #expect(Data(line.utf8) == sorted)
    }

    @Test(arguments: [1, 3, 5])
    func stopsAtMissingSampleWithoutAReport(_ missingTrial: Int) {
        var attempts = 0
        let result = LayoutProbeCommand.measure { _ in
            attempts += 1
            guard attempts != missingTrial else { return nil }
            return .init(initialViewportMicroseconds: 1, narrowViewportMicroseconds: 2, endViewportMicroseconds: 3)
        }

        #expect(attempts == missingTrial)
        #expect(result == nil)
    }

    @Test(arguments: [0, 1, 2])
    func stopsAtNegativeDurationInAnyPhase(_ phase: Int) {
        var attempts = 0
        let result = LayoutProbeCommand.measure { _ in
            attempts += 1
            return .init(initialViewportMicroseconds: attempts == 2 && phase == 0 ? -1 : 1,
                         narrowViewportMicroseconds: attempts == 2 && phase == 1 ? -1 : 2,
                         endViewportMicroseconds: attempts == 2 && phase == 2 ? -1 : 3)
        }

        #expect(attempts == 2)
        #expect(result == nil)
    }
}
