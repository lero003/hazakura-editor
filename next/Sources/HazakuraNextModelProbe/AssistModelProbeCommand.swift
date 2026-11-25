import Foundation
import Synchronization

/// Deliberately separate from the editor and the approval demo. Accepts no document or prompt input.
@MainActor
enum AssistModelProbeCommand {
    enum Mode: Equatable { case invalid, check, generate, compare }

    enum Status: String, Encodable {
        case checked, unavailable, completed, invalidOutput, failed, timedOut, cancelled
    }

    struct Report: Encodable {
        let backend = "foundationModelsOnDevice"
        let fixture = "ja-rephrase-v1"
        let status: Status
        let availability: AssistFoundationModelProbe.Availability
        var elapsedMilliseconds: Int64? = nil
        var responseUTF8Bytes: Int? = nil

        var exitCode: Int32 {
            switch status {
            case .checked, .completed: 0
            case .unavailable: 3
            case .invalidOutput, .failed: 1
            case .timedOut: 124
            case .cancelled: 130
            }
        }

        func jsonLine() throws -> String { try AssistModelProbeCommand.jsonLine(for: self) }
    }

    struct ComparisonReport: Encodable {
        let first: Report
        let second: Report?

        var exitCode: Int32 { second?.exitCode ?? first.exitCode }

        func jsonLine() throws -> String { try AssistModelProbeCommand.jsonLine(for: self) }
    }

    nonisolated private static func jsonLine(for report: some Encodable) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return String(decoding: try encoder.encode(report), as: UTF8.self) + "\n"
    }

    static func parse(_ arguments: [String]) -> Mode {
        switch arguments {
        case ["--check"]: .check
        case ["--generate"]: .generate
        case ["--compare"]: .compare
        default: .invalid
        }
    }

    private static let attemptLimit: Duration = .seconds(30)

    static func compare(
        availability: @MainActor () -> AssistFoundationModelProbe.Availability = AssistFoundationModelProbe.availability,
        waitUntilDeadline: @escaping @MainActor (ContinuousClock.Instant) async throws -> Void = {
            try await ContinuousClock().sleep(until: $0)
        },
        produce: @escaping @MainActor () async throws -> String = AssistFoundationModelProbe.generate
    ) async -> ComparisonReport {
        let first = await run(generate: true, availability: availability,
                              waitUntilDeadline: waitUntilDeadline, produce: produce)
        guard first.status == .completed else { return ComparisonReport(first: first, second: nil) }
        // Each run checks availability and cancellation again; the engine opens a new session.
        let second = await run(generate: true, availability: availability,
                               waitUntilDeadline: waitUntilDeadline, produce: produce)
        return ComparisonReport(first: first, second: second)
    }

    static func run(
        generate: Bool,
        availability: @MainActor () -> AssistFoundationModelProbe.Availability = AssistFoundationModelProbe.availability,
        waitUntilDeadline: @escaping @MainActor (ContinuousClock.Instant) async throws -> Void = {
            try await ContinuousClock().sleep(until: $0)
        },
        produce: @escaping @MainActor () async throws -> String = AssistFoundationModelProbe.generate
    ) async -> Report {
        let model = availability()
        guard generate else { return Report(status: .checked, availability: model) }
        let cancelled = Report(status: .cancelled, availability: model)
        guard !Task.isCancelled else { return cancelled }
        guard model == .available else { return Report(status: .unavailable, availability: model) }

        let stopRequested = Mutex(false)
        let result = await withTaskCancellationHandler {
            guard !Task.isCancelled else { return cancelled }
            let start = ContinuousClock.now
            let deadline = start.advanced(by: attemptLimit)
            let timedOut = Report(status: .timedOut, availability: model)
            let (results, continuation) = AsyncStream.makeStream(of: Report.self, bufferingPolicy: .bufferingOldest(1))
            // A task group would join a suspended SDK task even if it ignores cancellation.
            // Both publishers run on MainActor and finish the stream after the first offer.
            let worker = Task { @MainActor in
                // Cancellation may arrive before this job runs, while the consumer is suspended.
                guard !stopRequested.withLock({ $0 }) else { return }
                let report = ContinuousClock.now < deadline
                    ? await generateReport(availability: model, startedAt: start, produce: produce)
                    : timedOut
                continuation.yield(ContinuousClock.now < deadline ? report : timedOut)
                continuation.finish()
            }
            let watchdog = Task { @MainActor in
                let report: Report
                do {
                    try await waitUntilDeadline(deadline)
                    report = timedOut
                } catch {
                    report = Report(status: .failed, availability: model)
                }
                guard !Task.isCancelled else { return }
                stopRequested.withLock { $0 = true }
                continuation.yield(report)
                continuation.finish()
            }
            defer {
                stopRequested.withLock { $0 = true }
                continuation.finish()
                watchdog.cancel()
                // Task.cancel() can synchronously run SDK cancellation handlers. Neither that
                // call nor the worker's completion may delay the standalone CLI's report/exit.
                Task.detached { worker.cancel() }
            }
            var iterator = results.makeAsyncIterator()
            return await iterator.next() ?? cancelled
        } onCancel: {
            stopRequested.withLock { $0 = true }
        }
        return Task.isCancelled ? cancelled : result
    }

    private static func generateReport(
        availability model: AssistFoundationModelProbe.Availability,
        startedAt start: ContinuousClock.Instant,
        produce: @MainActor () async throws -> String
    ) async -> Report {
        do {
            let output = try await produce()
            try Task.checkCancellation()
            let bytes = output.utf8.prefix(2_049)
            guard bytes.count <= 2_048,
                  !output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  !bytes.contains(where: { ($0 < 32 && $0 != 9 && $0 != 10 && $0 != 13) || $0 == 127 }) else {
                return Report(status: .invalidOutput, availability: model)
            }
            let duration = start.duration(to: .now).components
            let milliseconds = duration.seconds * 1_000 + duration.attoseconds / 1_000_000_000_000_000
            return Report(status: .completed, availability: model,
                          elapsedMilliseconds: milliseconds, responseUTF8Bytes: bytes.count)
        } catch {
            // Never print the generated text, prompt, or an SDK error that might include them.
            return Report(status: Task.isCancelled || error is CancellationError ? .cancelled : .failed,
                          availability: model)
        }
    }
}
