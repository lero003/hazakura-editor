import Foundation

@MainActor
enum LayoutProbeCommand {
    static let trialCount = 5

    // Change the fixture ID if these input bytes change.
    private static let fixtureID = "ja-long-lines-v1"
    static let fixture: String = {
        let line = String(repeating: "春の川辺で、風に揺れる桜の花びらを見送りました。", count: 28)
        return String(repeating: line + "\n", count: 192) + "合成原稿の終点"
    }()

    struct Sample: Encodable {
        let initialViewportMicroseconds: Int64
        let narrowViewportMicroseconds: Int64
        let endViewportMicroseconds: Int64
    }

    struct Report: Encodable {
        let fixtureID: String
        let sourceUTF8Bytes: Int
        let samples: [Sample]
        private let aggregates: Aggregates

        fileprivate init(fixtureID: String, sourceUTF8Bytes: Int, samples: [Sample]) {
            self.fixtureID = fixtureID
            self.sourceUTF8Bytes = sourceUTF8Bytes
            self.samples = samples
            self.aggregates = Aggregates(samples)
        }

        func jsonLine() throws -> String {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            return String(decoding: try encoder.encode(self), as: UTF8.self)
        }
    }

    static func accepts(_ arguments: [String]) -> Bool {
        arguments == ["--measure"]
    }

    static func measure(using run: @MainActor (String) -> Sample?) -> Report? {
        let source = fixture
        var samples: [Sample] = []
        for _ in 0..<trialCount {
            guard let sample = run(source),
                  sample.initialViewportMicroseconds >= 0,
                  sample.narrowViewportMicroseconds >= 0,
                  sample.endViewportMicroseconds >= 0 else { return nil }
            samples.append(sample)
        }
        return Report(fixtureID: fixtureID, sourceUTF8Bytes: source.utf8.count, samples: samples)
    }

    private struct Aggregates: Encodable {
        let initialViewportMicroseconds: Summary
        let narrowViewportMicroseconds: Summary
        let endViewportMicroseconds: Summary

        init(_ samples: [Sample]) {
            initialViewportMicroseconds = Summary(samples.map(\.initialViewportMicroseconds))
            narrowViewportMicroseconds = Summary(samples.map(\.narrowViewportMicroseconds))
            endViewportMicroseconds = Summary(samples.map(\.endViewportMicroseconds))
        }
    }

    private struct Summary: Encodable {
        let min: Int64
        let median: Int64
        let max: Int64

        // Only a complete run (five samples) reaches this initializer.
        init(_ values: [Int64]) {
            let sorted = values.sorted()
            min = sorted[0]
            median = sorted[sorted.count / 2]
            max = sorted[sorted.count - 1]
        }
    }
}
