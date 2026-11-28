import Darwin
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceBookEPUBTests {
    @Test func writesOnlyTheConfirmedBookInOrderAndNeverReplacesAnExistingName() async throws {
        let session = WorkspaceSession(source: "# 最初の原稿")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let excluded = try #require(session.tabs.selectedID)
        session.applyCommittedSource("選択外の原稿", to: excluded)
        session.newTab()
        let last = try #require(session.tabs.selectedID)
        session.applyCommittedSource("# 最後の原稿", to: last)
        let drafts = session.tabs.recoveryDrafts
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let destination = folder.appending(path: "本.epub")

        let requestID = try stage(session, selected: [last, first])
        #expect(session.bookPreviewRequest == nil)
        #expect(session.exportPickerID == nil)
        #expect(session.exportDestinationRequest(requestID) == nil)
        #expect(session.isBusy)
        await session.writeRequestedExport(requestID, to: destination)
        #expect(FileManager.default.fileExists(atPath: destination.path) == false)
        #expect(session.exportRequest?.id == requestID)
        session.startPickingBookExport(requestID)
        #expect(session.exportPickerID == requestID)
        await session.writeRequestedExport(requestID, to: destination)
        let data = try Data(contentsOf: destination)
        #expect(EPUBStoredArchive.hasMimetypePrefix(data))
        let stored = String(decoding: data, as: UTF8.self)
        let opening = try #require(stored.range(of: "最初の原稿"))
        let ending = try #require(stored.range(of: "最後の原稿"))
        #expect(opening.lowerBound < ending.lowerBound)
        #expect(stored.contains("選択外の原稿") == false)
        #expect(session.fileNotice?.contains("書き出しました") == true)

        let retry = try stage(session, selected: [first, last])
        session.startPickingBookExport(retry)
        await session.writeRequestedExport(retry, to: destination)
        #expect(session.fileNotice?.contains("既に") == true)
        #expect(try Data(contentsOf: destination) == data)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(session.tabs.selectedID == last)
        #expect(session.isBusy == false)
    }

    @Test func stagedAndCancelledOperationsCannotStartOrAuthorizeLaterWrites() async throws {
        let session = WorkspaceSession(source: "A")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        let stale = try stage(session, selected: [first, second])
        session.cancelExport(stale)
        let current = try stage(session, selected: [first, second])
        session.startPickingBookExport(stale)
        #expect(session.exportPickerID == nil)
        session.cancelExport(stale)
        session.startPickingBookExport(current)
        #expect(session.exportPickerID == current)
        await session.writeRequestedExport(stale, to: URL(fileURLWithPath: "/synthetic/book.epub"), using: .init(
            writeEPUB: { _, _ in Issue.record("A stale permission cannot reach publication.") },
            renderBookEPUB: { _ in Issue.record("A stale request cannot start rendering."); return Data() }
        ))
        await session.writeRequestedExport(current, to: URL(fileURLWithPath: "/synthetic/book.pdf"), using: .init(
            writeEPUB: { _, _ in Issue.record("A mismatched extension cannot reach the writer.") },
            renderBookEPUB: { _ in Issue.record("A mismatched extension cannot start rendering."); return Data() }
        ))
        #expect(session.exportRequest == nil)
        #expect(session.fileNotice?.contains(".epub") == true)
    }

    @Test(arguments: [false, true])
    func changedNonactiveManuscriptOrCancellationDuringRenderPreventsPublishing(cancel: Bool) async throws {
        let session = WorkspaceSession(source: "A")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        let id = try stage(session, selected: [first, second])
        session.startPickingBookExport(id)
        let suspension = ExportSuspension()
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                await session.writeRequestedExport(id, to: URL(fileURLWithPath: "/synthetic/book.epub"), using: .init(
                    writeEPUB: { _, _ in Issue.record("An expired request cannot publish the archive.") },
                    renderBookEPUB: { sources in
                        #expect(sources.map(\.id) == [first, second])
                        await suspension.pause()
                        return Data()
                    }
                ))
                suspension.resume()
            }
            await suspension.waitForPause()
            if cancel { session.cancelExport(id) }
            else { session.applyCommittedSource("変更された確定原文", to: first) }
            #expect(session.isBusy)
            suspension.resume()
        }
        #expect(session.exportRequest == nil)
        #expect(session.tabs.selectedID == second)
        if cancel { #expect(session.fileNotice == nil) }
        else { #expect(session.fileNotice?.contains("原稿の状態が変わった") == true) }
    }

    @Test func aLateCommitBeforeStagingDoesNotSwitchTheConfirmedInput() throws {
        let session = WorkspaceSession(source: "A")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        session.requestBookPreview()
        let book = try #require(session.bookPreviewRequest)
        let sources = session.confirmBookPreview(book.id, selected: [first, second])
        try #require(sources != nil)
        session.applyCommittedSource("新しい版", to: first)
        #expect(session.prepareBookEPUB(book.id) == false)
        #expect(session.exportRequest == nil)
        #expect(session.bookPreviewRequest?.id == book.id)
    }

    private func stage(_ session: WorkspaceSession, selected: Set<UUID>) throws -> UUID {
        session.requestBookPreview()
        let book = try #require(session.bookPreviewRequest)
        let sources = session.confirmBookPreview(book.id, selected: selected)
        try #require(sources != nil)
        let prepared = session.prepareBookEPUB(book.id)
        try #require(prepared)
        return try #require(session.exportRequest?.id)
    }

    private func temporaryFolder() throws -> URL {
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-book-epub-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        return folder
    }
}
