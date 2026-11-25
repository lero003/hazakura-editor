import Foundation
import Testing
@testable import HazakuraNextModelProbe

@MainActor
struct AssistModelProbeCommandTests {
    @Test func onlyTheExactCommandFormsEnableTheProbe() {
        #expect(AssistModelProbeCommand.parse(["--check"]) == .check)
        #expect(AssistModelProbeCommand.parse(["--generate"]) == .generate)
        #expect(AssistModelProbeCommand.parse(["--compare"]) == .compare)
        for arguments in [[], ["--long-sample"], ["--check", "--generate"], ["--check", "--check"],
                          ["--generate", "合成でない入力"], ["--generate", "--check"], ["/not/an/input"],
                          ["--compare", "合成でない入力"], ["--compare", "/not/an/input"],
                          ["--compare", "--compare"], ["--compare", "--generate"], ["--check", "--compare"]] {
            #expect(AssistModelProbeCommand.parse(arguments) == .invalid)
        }
    }

    @Test func comparisonRunsSequentiallyAndEncodesOnlyOrderedMetrics() async throws {
        let candidates = ["試行一の候補", "試行二では異なる長さの候補"]
        var events: [String] = []
        var attempts = 0
        let report = await AssistModelProbeCommand.compare(availability: {
            events.append("check")
            return .available
        }, produce: {
            let attempt = attempts
            attempts += 1
            events.append("start \(attempt)")
            await Task.yield()
            events.append("finish \(attempt)")
            return candidates.indices.contains(attempt) ? candidates[attempt] : "unexpected attempt"
        })

        #expect(events == ["check", "start 0", "finish 0", "check", "start 1", "finish 1"])
        #expect(report.exitCode == 0)
        let second = try #require(report.second)
        let line = try report.jsonLine()
        #expect(line.last == "\n")
        #expect(line.filter(\.isNewline).count == 1)
        let json = try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any])
        #expect(Set(json.keys) == ["first", "second"])
        for (key, attempt, candidate) in [("first", report.first, candidates[0]), ("second", second, candidates[1])] {
            #expect(attempt.status == .completed)
            #expect(attempt.availability == .available)
            #expect(attempt.responseUTF8Bytes == candidate.utf8.count)
            let elapsed = try #require(attempt.elapsedMilliseconds)
            #expect(elapsed >= 0)
            let metrics = try #require(json[key] as? [String: Any])
            #expect(Set(metrics.keys) == ["backend", "fixture", "status", "availability", "elapsedMilliseconds", "responseUTF8Bytes"])
            #expect(metrics["backend"] as? String == "foundationModelsOnDevice")
            #expect(metrics["fixture"] as? String == "ja-rephrase-v1")
            #expect(metrics["status"] as? String == "completed")
            #expect(metrics["availability"] as? String == "available")
            #expect(metrics["responseUTF8Bytes"] as? Int == candidate.utf8.count)
            #expect(metrics["elapsedMilliseconds"] as? Int64 == elapsed)
            #expect(line.contains(candidate) == false)
        }
    }

    @Test(arguments: [1, 2])
    func comparisonDoesNotRetryFailedGeneration(_ failureAttempt: Int) async throws {
        struct PrivateComparisonDiagnostic: Error, CustomStringConvertible {
            let description: String
        }
        let payload = "private-engine-diagnostic-33"
        var checks = 0
        var attempts = 0
        let report = await AssistModelProbeCommand.compare(availability: {
            checks += 1
            return .available
        }, produce: {
            attempts += 1
            if attempts == failureAttempt { throw PrivateComparisonDiagnostic(description: payload) }
            return "最初の候補"
        })

        #expect(checks == failureAttempt)
        #expect(attempts == failureAttempt)
        let failed: AssistModelProbeCommand.Report
        if failureAttempt == 1 {
            failed = report.first
            #expect(report.second == nil)
        } else {
            #expect(report.first.status == .completed)
            #expect(report.first.responseUTF8Bytes == "最初の候補".utf8.count)
            failed = try #require(report.second)
        }
        #expect(failed.status == .failed)
        #expect(failed.responseUTF8Bytes == nil)
        #expect(failed.elapsedMilliseconds == nil)
        #expect(report.exitCode == 1)
        let line = try report.jsonLine()
        #expect(line.contains(payload) == false)
        #expect(line.contains("PrivateComparisonDiagnostic") == false)
        #expect(line.contains("最初の候補") == false)
    }

    @Test func comparisonChecksAvailabilityAgainBeforeSecondGeneration() async throws {
        var available = true
        var checks = 0
        var attempts = 0
        let report = await AssistModelProbeCommand.compare(availability: {
            checks += 1
            return available ? .available : .modelNotReady
        }, produce: {
            attempts += 1
            available = false
            return "最初の応答"
        })

        #expect(checks == 2)
        #expect(attempts == 1)
        #expect(report.first.status == .completed)
        #expect(report.first.availability == .available)
        #expect(report.first.responseUTF8Bytes == "最初の応答".utf8.count)
        let second = try #require(report.second)
        #expect(second.status == .unavailable)
        #expect(second.availability == .modelNotReady)
        #expect(second.responseUTF8Bytes == nil)
        #expect(second.elapsedMilliseconds == nil)
        #expect(report.exitCode == 3)
    }

    @Test(arguments: [1, 2])
    func comparisonOmitsMetricsFromResultsReturningAfterCancellation(_ cancelledAttempt: Int) async throws {
        var checks = 0
        var attempts = 0
        let lateCandidate = "取消後に届いた候補"
        let task = Task { @MainActor in
            await AssistModelProbeCommand.compare(availability: {
                checks += 1
                return .available
            }, produce: {
                attempts += 1
                if attempts == cancelledAttempt {
                    withUnsafeCurrentTask { $0?.cancel() }
                    return lateCandidate
                }
                return "取消前の候補"
            })
        }
        let report = await task.value

        #expect(checks == cancelledAttempt)
        #expect(attempts == cancelledAttempt)
        let cancelled: AssistModelProbeCommand.Report
        if cancelledAttempt == 1 {
            cancelled = report.first
            #expect(report.second == nil)
        } else {
            #expect(report.first.status == .completed)
            #expect(report.first.responseUTF8Bytes == "取消前の候補".utf8.count)
            cancelled = try #require(report.second)
        }
        #expect(cancelled.status == .cancelled)
        #expect(cancelled.responseUTF8Bytes == nil)
        #expect(cancelled.elapsedMilliseconds == nil)
        #expect(report.exitCode == 130)
        let line = try report.jsonLine()
        #expect(line.contains(lateCandidate) == false)
        let object = try JSONSerialization.jsonObject(with: Data(line.utf8))
        let json = try #require(object as? [String: Any])
        let key = cancelledAttempt == 1 ? "first" : "second"
        let cancelledMetrics = try #require(json[key] as? [String: Any])
        #expect(Set(cancelledMetrics.keys) == ["backend", "fixture", "status", "availability"])
        #expect(cancelledMetrics["status"] as? String == "cancelled")
    }

    @Test func availabilityCheckDoesNotGenerateEvenWhenAvailable() async {
        let report = await AssistModelProbeCommand.run(generate: false, availability: { .available }) {
            Issue.record("An availability-only request must not start inference.")
            return "unused"
        }
        #expect(report.status == .checked)
        #expect(report.availability == .available)
        #expect(report.responseUTF8Bytes == nil)
        #expect(report.exitCode == 0)
    }

    @Test func unavailabilityDoesNotFallBackOrInvokeGeneration() async {
        let report = await AssistModelProbeCommand.run(generate: true, availability: { .modelNotReady }) {
            Issue.record("An unavailable local model must not generate or fall back.")
            return "unused"
        }
        #expect(report.status == .unavailable)
        #expect(report.availability == .modelNotReady)
        #expect(report.responseUTF8Bytes == nil)
        #expect(report.exitCode != 0)
    }

    @Test func generationReportsOnlyBoundedMetrics() async throws {
        var calls = 0
        let syntheticOutput = "候補の内容を表示しない"
        let report = await AssistModelProbeCommand.run(generate: true, availability: { .available }) {
            calls += 1
            return syntheticOutput
        }
        let line = try report.jsonLine()
        #expect(calls == 1)
        #expect(report.status == .completed)
        #expect(report.responseUTF8Bytes == syntheticOutput.utf8.count)
        #expect(report.elapsedMilliseconds != nil)
        #expect(report.exitCode == 0)
        #expect(!line.contains(syntheticOutput))
        #expect(line.last == "\n")
    }

    @Test(arguments: [" \t\n", "a\u{0000}b", "a\u{007F}b", String(repeating: "稿", count: 683)])
    func refusesInvalidMetricOutput(_ output: String) async {
        let report = await AssistModelProbeCommand.run(generate: true, availability: { .available }) { output }
        #expect(report.status == .invalidOutput)
        #expect(report.responseUTF8Bytes == nil)
        #expect(report.exitCode != 0)
    }

    @Test func cancelledTaskDoesNotStartGeneration() async {
        let task = Task { @MainActor in
            await AssistModelProbeCommand.run(generate: true, availability: { .available }) {
                Issue.record("A cancelled task must not call the model.")
                return "unused"
            }
        }
        task.cancel()
        let report = await task.value
        #expect(report.status == .cancelled)
        #expect(report.responseUTF8Bytes == nil)
    }

    @Test func resultReturningAfterCancellationCannotPublishMetrics() async {
        let operation = Task { @MainActor in
            await AssistModelProbeCommand.run(generate: true, availability: { .available }) {
                withUnsafeCurrentTask { $0?.cancel() }
                return "遅れて返った候補"
            }
        }
        let report = await operation.value
        #expect(report.status == .cancelled)
        #expect(report.responseUTF8Bytes == nil)
        #expect(report.elapsedMilliseconds == nil)
    }

    @Test func theByteLimitIsInclusive() async {
        let report = await AssistModelProbeCommand.run(generate: true, availability: { .available }) {
            String(repeating: "稿", count: 682) + "ok"
        }
        #expect(report.status == .completed)
        #expect(report.responseUTF8Bytes == 2_048)
    }

    @Test func engineErrorsDoNotLeakPayload() async throws {
        struct PrivateDiagnostic: Error {}
        let report = await AssistModelProbeCommand.run(generate: true, availability: { .available }) {
            throw PrivateDiagnostic()
        }
        #expect(report.status == .failed)
        #expect(report.exitCode != 0)
        let line = try report.jsonLine()
        #expect(!line.contains("PrivateDiagnostic"))
    }
}
