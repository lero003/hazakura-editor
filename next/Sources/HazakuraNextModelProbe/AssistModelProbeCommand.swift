import Foundation

/// Deliberately separate from the editor and the approval demo. Accepts no document or prompt input.
@MainActor
enum AssistModelProbeCommand {
    enum Mode: Equatable { case invalid, check, generate, compare }

    enum Status: String, Encodable {
        case checked, unavailable, completed, invalidOutput, failed, cancelled
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

    static func compare(
        availability: @MainActor () -> AssistFoundationModelProbe.Availability = AssistFoundationModelProbe.availability,
        produce: @MainActor () async throws -> String = AssistFoundationModelProbe.generate
    ) async -> ComparisonReport {
        let first = await run(generate: true, availability: availability, produce: produce)
        guard first.status == .completed else { return ComparisonReport(first: first, second: nil) }
        // Each run checks availability and cancellation again; the engine opens a new session.
        let second = await run(generate: true, availability: availability, produce: produce)
        return ComparisonReport(first: first, second: second)
    }

    static func run(
        generate: Bool,
        availability: @MainActor () -> AssistFoundationModelProbe.Availability = AssistFoundationModelProbe.availability,
        produce: @MainActor () async throws -> String = AssistFoundationModelProbe.generate
    ) async -> Report {
        let model = availability()
        guard generate else { return Report(status: .checked, availability: model) }
        guard !Task.isCancelled else { return Report(status: .cancelled, availability: model) }
        guard model == .available else { return Report(status: .unavailable, availability: model) }
        let start = ContinuousClock.now
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
