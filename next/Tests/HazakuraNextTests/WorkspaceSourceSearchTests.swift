import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceSourceSearchTests {
    @Test func selectsALiteralMatchOnlyInTheSameCommittedBuffer() async throws {
        let session = WorkspaceSession(source: "")
        let id = try #require(session.tabs.selectedID)
        let source = "# 🌸\r\n[桜](桜.md)\n"
        session.applyCommittedSource(source, to: id)
        let revision = session.tabs.selectedTab?.document.revision
        let recovery = session.tabs.recoveryDrafts
        session.requestSourceSearch()
        let request = try #require(session.sourceSearchRequest)
        #expect(session.isBusy)
        #expect(!session.canEditSource)
        let report = try #require(await session.searchSource(request.id, query: "桜"))
        #expect(report.results.matches.map(\.line) == [2, 2])
        let match = try #require(report.results.matches.last)
        #expect(session.readySourceRevealID == nil)
        #expect(!session.selectSourceSearchMatch(request.id, reportID: report.id, matchID: -1))
        #expect(session.selectSourceSearchMatch(request.id, reportID: report.id, matchID: match.id))
        #expect(session.sourceSearchRequest == nil)
        #expect(!session.isBusy)
        #expect(session.takeSourceReveal(request.id, documentID: UUID(), editorSource: source) == nil)
        #expect(session.takeSourceReveal(request.id, documentID: id, editorSource: source) == match.range)
        #expect(session.takeSourceReveal(request.id, documentID: id, editorSource: source) == nil)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDrafts == recovery)
    }

    @Test func rejectsSupersededReportsAndDropsPendingResultsOnComposition() async throws {
        let session = WorkspaceSession(source: "あ い あ")
        let id = try #require(session.tabs.selectedID)
        session.requestSourceSearch()
        let request = try #require(session.sourceSearchRequest)
        let first = try #require(await session.searchSource(request.id, query: "あ"))
        let second = try #require(await session.searchSource(request.id, query: "い"))
        let firstMatch = try #require(first.results.matches.first)
        let secondMatch = try #require(second.results.matches.first)
        #expect(!session.selectSourceSearchMatch(request.id, reportID: first.id, matchID: firstMatch.id))
        session.tabs.setComposing(true, in: id)
        #expect(session.sourceSearchRequest == nil)
        #expect(!session.selectSourceSearchMatch(request.id, reportID: second.id, matchID: secondMatch.id))
        session.requestSourceSearch()
        #expect(session.sourceSearchRequest == nil)
        #expect(session.readySourceRevealID == nil)
    }

    @Test func resettingAnInFlightSearchPreventsItsLateReport() async throws {
        let session = WorkspaceSession(source: "窓と戸")
        session.requestSourceSearch()
        let request = try #require(session.sourceSearchRequest)
        let started = AsyncStream<Void>.makeStream()
        let resumeScan = AsyncStream<Void>.makeStream()
        defer {
            started.continuation.finish()
            resumeScan.continuation.finish()
        }
        let obsolete = Task {
            await session.searchSource(request.id, query: "窓") { source, query in
                started.continuation.yield(())
                started.continuation.finish()
                var iterator = resumeScan.stream.makeAsyncIterator()
                _ = await iterator.next()
                return SourceSearch.search(query, in: source)
            }
        }
        var iterator = started.stream.makeAsyncIterator()
        _ = await iterator.next()
        session.resetSourceSearch(request.id)
        let current = try #require(await session.searchSource(request.id, query: "戸"))
        resumeScan.continuation.finish()
        #expect(await obsolete.value == nil)
        let match = try #require(current.results.matches.first)
        #expect(session.selectSourceSearchMatch(request.id, reportID: current.id, matchID: match.id))
    }

    @Test func byteDifferentNativeBufferCannotApplyASelection() async throws {
        let source = "か\u{3099} 原稿"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestSourceSearch()
        let request = try #require(session.sourceSearchRequest)
        let report = try #require(await session.searchSource(request.id, query: "原稿"))
        let match = try #require(report.results.matches.first)
        #expect(session.selectSourceSearchMatch(request.id, reportID: report.id, matchID: match.id))
        #expect(session.takeSourceReveal(request.id, documentID: id, editorSource: "が 原稿") == nil)
        #expect(session.readySourceRevealID == nil)
    }

    @Test func cancellationAndRevisionChangesRejectSearchResults() async throws {
        let source = "元の原稿"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestSourceSearch()
        let request = try #require(session.sourceSearchRequest)
        let report = try #require(await session.searchSource(request.id, query: "原稿"))
        let match = try #require(report.results.matches.first)
        session.dismissSourceSearch(request.id)
        #expect(!session.selectSourceSearchMatch(request.id, reportID: report.id, matchID: match.id))
        session.requestSourceSearch()
        let active = try #require(session.sourceSearchRequest)
        let current = try #require(await session.searchSource(active.id, query: "原稿"))
        session.applyCommittedSource(source + "。", to: id)
        session.applyCommittedSource(source, to: id)
        #expect(!session.selectSourceSearchMatch(active.id, reportID: current.id, matchID: match.id))
        #expect(session.readySourceRevealID == nil)
    }
}
