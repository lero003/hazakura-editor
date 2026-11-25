import Testing
@testable import HazakuraNextModelProbe

@MainActor
struct AssistModelProbeCommandTests {
    @Test func onlyTheExactCommandFormsEnableTheProbe() {
        #expect(AssistModelProbeCommand.parse(["--check"]) == .check)
        #expect(AssistModelProbeCommand.parse(["--generate"]) == .generate)
        for arguments in [[], ["--long-sample"], ["--check", "--generate"], ["--check", "--check"],
                          ["--generate", "合成でない入力"], ["--generate", "--check"], ["/not/an/input"]] {
            #expect(AssistModelProbeCommand.parse(arguments) == .invalid)
        }
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
