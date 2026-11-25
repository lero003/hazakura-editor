import Foundation
import Testing
@testable import HazakuraNextModelProbe

@MainActor
struct AssistModelProbeDeadlineTests {
    enum Stop: Sendable { case deadline, parentCancellation }

    @Test(arguments: [Stop.deadline, .parentCancellation])
    func generationReturnsWhileTheProducerIgnoresCancellation(_ stop: Stop) async throws {
        let fixture = DeadlineFixture(blockedAttempt: 1)
        let watchdog = fixture.watchForStall()
        let operation = Task {
            let report = await AssistModelProbeCommand.run(
                generate: true, availability: fixture.availability,
                waitUntilDeadline: fixture.waitUntilDeadline, produce: fixture.produce
            )
            fixture.events.continuation.yield(.reportReturned)
            return report
        }
        defer {
            operation.cancel()
            watchdog.cancel()
            fixture.cleanUp()
        }
        var events = fixture.events.stream.makeAsyncIterator()
        try #require(await events.next() == .producerBlocked, "The producer must be in flight.")
        switch stop {
        case .deadline: fixture.reachDeadline()
        case .parentCancellation: operation.cancel()
        }
        try #require(await events.next() == .reportReturned, "The caller must receive its report before the producer is released.")
        let report = await operation.value
        let expectedStatus: AssistModelProbeCommand.Status = stop == .deadline ? .timedOut : .cancelled
        verifyStopped(report, status: expectedStatus, exitCode: stop == .deadline ? 124 : 130)
        let line = try report.jsonLine()
        let json = try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: String])
        #expect(json == ["backend": "foundationModelsOnDevice", "fixture": "ja-rephrase-v1",
                         "status": expectedStatus.rawValue, "availability": "available"])

        try #require(await fixture.waitForProducerCancellation(), "The probe must request cancellation of the producer.")
        fixture.releaseProducer()
        try #require(await events.next() == .lateSuccess)
        #expect(try report.jsonLine() == line)
        #expect(fixture.attempts == 1)
    }

    @Test(arguments: [1, 2])
    func comparisonStopsAtTheTimedOutAttempt(_ blockedAttempt: Int) async throws {
        let fixture = DeadlineFixture(blockedAttempt: blockedAttempt)
        let watchdog = fixture.watchForStall()
        let operation = Task {
            let report = await AssistModelProbeCommand.compare(
                availability: fixture.availability,
                waitUntilDeadline: fixture.waitUntilDeadline, produce: fixture.produce
            )
            fixture.events.continuation.yield(.reportReturned)
            return report
        }
        defer {
            operation.cancel()
            watchdog.cancel()
            fixture.cleanUp()
        }
        var events = fixture.events.stream.makeAsyncIterator()
        try #require(await events.next() == .producerBlocked, "The selected comparison attempt must be in flight.")
        fixture.reachDeadline()
        try #require(await events.next() == .reportReturned, "Comparison must not join the timed-out producer.")
        let report = await operation.value
        #expect(report.exitCode == 124)
        #expect(fixture.checks == blockedAttempt)
        #expect(fixture.attempts == blockedAttempt)

        let timedOut: AssistModelProbeCommand.Report
        if blockedAttempt == 1 {
            timedOut = report.first
            #expect(report.second == nil)
        } else {
            #expect(report.first.status == .completed)
            #expect(report.first.responseUTF8Bytes == fixture.firstCandidate.utf8.count)
            #expect(report.first.elapsedMilliseconds != nil)
            timedOut = try #require(report.second)
        }
        verifyStopped(timedOut, status: .timedOut, exitCode: 124)
        let line = try report.jsonLine()
        let json = try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any])
        #expect(Set(json.keys) == (blockedAttempt == 1 ? ["first"] : ["first", "second"]))
        let stopped = try #require(json[blockedAttempt == 1 ? "first" : "second"] as? [String: String])
        #expect(stopped == ["backend": "foundationModelsOnDevice", "fixture": "ja-rephrase-v1",
                            "status": "timedOut", "availability": "available"])
        #expect(line.contains(fixture.firstCandidate) == false)
        #expect(line.contains(fixture.lateCandidate) == false)

        try #require(await fixture.waitForProducerCancellation(), "The probe must request cancellation of the producer.")
        fixture.releaseProducer()
        try #require(await events.next() == .lateSuccess)
        #expect(try report.jsonLine() == line)
        #expect(fixture.attempts == blockedAttempt)
    }

    private func verifyStopped(
        _ report: AssistModelProbeCommand.Report,
        status: AssistModelProbeCommand.Status,
        exitCode: Int32,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        #expect(report.status == status, sourceLocation: sourceLocation)
        #expect(report.exitCode == exitCode, sourceLocation: sourceLocation)
        #expect(report.elapsedMilliseconds == nil, sourceLocation: sourceLocation)
        #expect(report.responseUTF8Bytes == nil, sourceLocation: sourceLocation)
    }
}

@MainActor
private final class DeadlineFixture {
    enum Event: Sendable { case producerBlocked, reportReturned, lateSuccess }

    let events = AsyncStream<Event>.makeStream()
    let firstCandidate = "synthetic-first-candidate"
    let lateCandidate = "synthetic-late-candidate"
    private(set) var attempts = 0
    private(set) var checks = 0
    private let blockedAttempt: Int
    private var deadlineWaits = 0
    private let firstWaitInstalled = Gate()
    private let producerGate = Gate()
    private let producerCancellation = AsyncStream<Void>.makeStream()
    private let firstDeadline = AsyncStream<Void>.makeStream()
    private let blockedDeadline = AsyncStream<Void>.makeStream()

    init(blockedAttempt: Int) { self.blockedAttempt = blockedAttempt }

    func availability() -> AssistFoundationModelProbe.Availability {
        checks += 1
        return .available
    }

    func produce() async -> String {
        attempts += 1
        if attempts < blockedAttempt {
            // Do not let the first success cancel its timer before the waiter is installed.
            await firstWaitInstalled.wait()
            return firstCandidate
        }
        guard attempts == blockedAttempt else {
            Issue.record("Unexpected generation after a stopped attempt.")
            return "unexpected-candidate"
        }
        await withTaskCancellationHandler {
            events.continuation.yield(.producerBlocked)
            await producerGate.wait()
        } onCancel: { [continuation = producerCancellation.continuation] in
            continuation.yield(())
        }
        events.continuation.yield(.lateSuccess)
        return lateCandidate
    }

    func waitUntilDeadline(_: ContinuousClock.Instant) async throws {
        deadlineWaits += 1
        let isFirst = deadlineWaits < blockedAttempt
        if isFirst { firstWaitInstalled.open() }
        var iterator = (isFirst ? firstDeadline.stream : blockedDeadline.stream).makeAsyncIterator()
        guard await iterator.next() != nil else { throw CancellationError() }
        try Task.checkCancellation()
    }

    func reachDeadline() { blockedDeadline.continuation.yield(()) }
    func releaseProducer() { producerGate.open() }

    func waitForProducerCancellation() async -> Bool {
        var iterator = producerCancellation.stream.makeAsyncIterator()
        return await iterator.next() != nil
    }

    func watchForStall() -> Task<Void, Never> {
        Task { [events = events.continuation, cancelled = producerCancellation.continuation] in
            // Failure-only watchdog; successful tests progress entirely by explicit events.
            do { try await Task.sleep(for: .seconds(5)) } catch { return }
            events.finish()
            cancelled.finish()
        }
    }

    func cleanUp() {
        firstWaitInstalled.open()
        producerGate.open()
        firstDeadline.continuation.finish()
        blockedDeadline.continuation.finish()
        producerCancellation.continuation.finish()
        events.continuation.finish()
    }

    // Unlike AsyncStream, this gate deliberately keeps the mock producer suspended on cancellation.
    @MainActor
    private final class Gate {
        private var isOpen = false
        private var waiter: CheckedContinuation<Void, Never>?

        func wait() async {
            guard !isOpen else { return }
            await withCheckedContinuation { waiter = $0 }
        }

        func open() {
            isOpen = true
            let pending = waiter
            waiter = nil
            pending?.resume()
        }
    }
}
