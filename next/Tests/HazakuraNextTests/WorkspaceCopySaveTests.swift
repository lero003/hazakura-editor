import AppKit
import Darwin
@testable import HazakuraNext
import Foundation
import HazakuraNextCore
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceCopySaveTests {
    @Test func explicitSaveFreezesOneSnapshotAndLeavesDraftOpen() async throws {
        let session = WorkspaceSession(source: "下書き")
        let draftID = try #require(session.tabs.selectedID)
        session.applyCommittedSource("# か\u{3099}\r\n", to: draftID)
        session.requestSaveCopy()
        let request = try #require(session.saveCopyRequest)
        #expect(session.isBusy)
        #expect(!session.canEditSource)
        session.requestOpen()
        session.newTab()
        session.requestSaveCopy()
        #expect(session.openRequest == nil)
        #expect(session.tabs.tabs.count == 1)
        #expect(session.saveCopyRequest?.id == request.id)
        let intendedURL = URL(fileURLWithPath: "/synthetic/fixture.md")
        let writer = CopyWriterProbe()
        await session.writeRequestedCopy(request.id, to: intendedURL, using: { await writer.record($0, $1, $2) })
        #expect(await writer.calls() == [CopyWriterProbe.Call(bytes: Data("# か\u{3099}\r\n".utf8), encoding: .utf8, url: intendedURL)])
        #expect(session.saveCopyRequest == nil)
        #expect(session.canEditSource)
        #expect(session.tabs.selectedID == draftID)
        #expect(session.tabs.recoveryDrafts.count == 1)
    }

    @Test func savedCopyStatusFollowsTheExactRevisionInItsOwnTab() async throws {
        let session = WorkspaceSession(source: "下書き")
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("確定原稿", to: id)
        let revision = session.tabs.selectedTab?.document.revision
        let recovery = session.tabs.recoveryDrafts
        #expect(session.selectedCopySaveStatus == nil)
        session.requestSaveCopy()
        let first = try #require(session.saveCopyRequest?.id)
        let destination = URL(fileURLWithPath: "/synthetic/copy.md")
        await session.writeRequestedCopy(first, to: destination) { _, _, _ in }
        #expect(session.selectedCopySaveStatus == .currentRevision)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDrafts == recovery)
        guard case .confirm = session.tabs.requestCloseSelected() else {
            Issue.record("Copy save must not bypass discard confirmation.")
            return
        }

        session.newTab()
        #expect(session.selectedCopySaveStatus == nil)
        session.tabs.select(id)
        #expect(session.selectedCopySaveStatus == .currentRevision)
        session.tabs.setComposing(true, in: id)
        #expect(session.selectedCopySaveStatus == nil)
        session.tabs.setComposing(false, in: id)
        #expect(session.selectedCopySaveStatus == .currentRevision)
        session.applyCommittedSource("新しい追記", to: id)
        session.applyCommittedSource("確定原稿", to: id)
        #expect(session.selectedCopySaveStatus == .earlierRevision)

        session.requestSaveCopy()
        let second = try #require(session.saveCopyRequest?.id)
        #expect(session.selectedCopySaveStatus == nil)
        session.cancelSaveCopy(second)
        #expect(session.selectedCopySaveStatus == .earlierRevision)
        session.requestSaveCopy()
        let failed = try #require(session.saveCopyRequest?.id)
        await session.writeRequestedCopy(failed, to: destination) { _, _, _ in
            throw SelectedTextCopyWriter.WriteError.alreadyExists
        }
        #expect(session.selectedCopySaveStatus == .earlierRevision)
        session.requestSaveCopy()
        let third = try #require(session.saveCopyRequest?.id)
        await session.writeRequestedCopy(third, to: destination) { _, _, _ in }
        #expect(session.selectedCopySaveStatus == .currentRevision)
    }

    @Test func aLateSuccessfulCopyRecordsOnlyWhatWasActuallyWritten() async throws {
        let session = WorkspaceSession(source: "初稿")
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("書き出す版", to: id)
        session.requestSaveCopy()
        let request = try #require(session.saveCopyRequest?.id)
        let finishWriting = AsyncStream<Void>.makeStream()
        defer { finishWriting.continuation.finish() }
        let destination = URL(fileURLWithPath: "/synthetic/older.md")
        let writer = CopyWriterProbe()
        let writing = Task.immediate { @MainActor in
            await session.writeRequestedCopy(request, to: destination) {
                await writer.record($0, $1, $2)
                for await _ in finishWriting.stream {}
            }
        }
        #expect(session.selectedCopySaveStatus == nil)
        session.applyCommittedSource("書き出し開始後の確定原稿", to: id)
        let recovery = session.tabs.recoveryDrafts
        finishWriting.continuation.finish()
        await writing.value
        #expect(await writer.calls() == [.init(bytes: Data("書き出す版".utf8), encoding: .utf8, url: destination)])
        #expect(session.selectedCopySaveStatus == .earlierRevision)
        #expect(session.tabs.recoveryDrafts == recovery)
    }

    @Test func cancelsOrRejectsAStaleRevisionWithoutWriting() async throws {
        let session = WorkspaceSession(source: "下書き")
        let draftID = try #require(session.tabs.selectedID)
        let destination = URL(fileURLWithPath: "/synthetic/never-written.md")
        let writer = CopyWriterProbe()
        session.tabs.setComposing(true, in: draftID)
        session.requestSaveCopy()
        #expect(session.saveCopyRequest == nil)
        session.tabs.setComposing(false, in: draftID)
        session.requestSaveCopy()
        let cancelled = try #require(session.saveCopyRequest?.id)
        session.cancelSaveCopy(cancelled)
        session.requestSaveCopy()
        let active = try #require(session.saveCopyRequest?.id)
        await session.writeRequestedCopy(cancelled, to: destination, using: { await writer.record($0, $1, $2) })
        #expect(session.saveCopyRequest?.id == active)
        // Even a late native callback must not save under an older confirmation.
        session.applyCommittedSource("新しい原文", to: draftID)
        await session.writeRequestedCopy(active, to: destination, using: { await writer.record($0, $1, $2) })
        #expect(await writer.calls().isEmpty)
        #expect(session.saveCopyRequest == nil)
        #expect(session.fileNotice != nil)
        #expect(session.tabs.selectedTab?.document.source == "新しい原文")
    }

    @Test func writingPreventsQuitAndDuplicateWritesUntilItFinishes() async throws {
        let delegate = ScratchApplicationDelegate(source: "下書き")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        session.requestSaveCopy()
        let request = try #require(session.saveCopyRequest?.id)
        let destination = URL(fileURLWithPath: "/synthetic/final.md")
        let began = AsyncStream<Void>.makeStream()
        let unblock = AsyncStream<Void>.makeStream()
        defer { began.continuation.finish(); unblock.continuation.finish() }
        let probe = CopyWriterProbe()
        // Reserve the injected writer before the hidden window's SwiftUI picker task gets a turn.
        let writing = Task.immediate { @MainActor in
            await session.writeRequestedCopy(request, to: destination) { source, encoding, url in
                await probe.record(source, encoding, url)
                began.continuation.finish()
                for await _ in unblock.stream {}
            }
        }
        for await _ in began.stream {}
        #expect(!delegate.windowShouldClose(window))
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateCancel)
        session.cancelSaveCopy(request)
        await session.writeRequestedCopy(request, to: destination, using: { await probe.record($0, $1, $2) })
        #expect(await probe.calls().count == 1)
        #expect(session.saveCopyRequest?.id == request)
        unblock.continuation.finish()
        await writing.value
        #expect(!session.isBusy)
    }

    @Test(arguments: [SelectedTextFile.Encoding.utf8BOM, .utf16LE, .utf16BE])
    func createsASeparateExactBOMCopyEvenIfTheOpenedFileChanges(_ encoding: SelectedTextFile.Encoding) async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-copy-workspace-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = folder.appending(path: "original.md")
        let destination = folder.appending(path: "copy.md")
        let initial = try markedBytes("# 最初の原文\r\n", encoding: encoding)
        try initial.write(to: original)
        let snapshot = try await SelectedTextFile.read(from: original)
        let session = WorkspaceSession(source: "サンプル")
        let opened = session.tabs.openReadOnly(snapshot)
        let originalTab = try #require(opened)
        session.requestSaveCopy()
        #expect(session.saveCopyRequest == nil)
        session.makeEditableCopy()
        let copy = try #require(session.tabs.selectedID)
        #expect(copy != originalTab)
        let edited = "# か\u{3099}\r\n末尾\r"
        session.applyCommittedSource(edited, to: copy)
        let external = Data("外部の更新".utf8)
        try external.write(to: original, options: .atomic)
        session.requestSaveCopy()
        let request = try #require(session.saveCopyRequest)
        #expect(request.encoding == encoding)
        await session.writeRequestedCopy(request.id, to: destination)
        #expect(try Data(contentsOf: original) == external)
        #expect(try Data(contentsOf: destination) == markedBytes(edited, encoding: encoding))
        #expect(session.selectedCopySaveStatus == .currentRevision)
        #expect(session.tabs.tabs.first(where: { $0.id == originalTab })?.selectedFile?.originalBytes == initial)
        #expect(session.tabs.selectedTab?.document.source.utf8.elementsEqual(edited.utf8) == true)

        let draft = try #require(session.tabs.recoveryDraft(for: copy))
        let recovered = session.tabs.restoreDraft(draft)
        try #require(recovered != nil)
        session.requestSaveCopy()
        let recoveredRequest = try #require(session.saveCopyRequest)
        #expect(recoveredRequest.encoding == .utf8)
        #expect(recoveredRequest.source.utf8.elementsEqual(edited.utf8))
    }

    private func markedBytes(_ source: String, encoding: SelectedTextFile.Encoding) throws -> Data {
        switch encoding {
        case .utf8: Data(source.utf8)
        case .utf8BOM: Data([0xEF, 0xBB, 0xBF]) + Data(source.utf8)
        case .utf16LE: Data([0xFF, 0xFE]) + (try #require(source.data(using: .utf16LittleEndian)))
        case .utf16BE: Data([0xFE, 0xFF]) + (try #require(source.data(using: .utf16BigEndian)))
        }
    }

    @Test func writerFailureDoesNotReplaceOrClearTheDraft() async throws {
        let session = WorkspaceSession(source: "下書き")
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("手元の編集", to: id)
        let before = session.tabs.recoveryDrafts
        session.exitNotice = "古い終了エラー"
        session.requestSaveCopy()
        #expect(session.exitNotice == nil)
        let request = try #require(session.saveCopyRequest?.id)
        await session.writeRequestedCopy(request, to: URL(fileURLWithPath: "/synthetic/existing.md")) { _, _, _ in
            throw SelectedTextCopyWriter.WriteError.alreadyExists
        }
        #expect(session.saveCopyRequest == nil)
        #expect(session.fileNotice?.contains("既に") == true)
        #expect(session.tabs.recoveryDrafts == before)
        #expect(session.tabs.selectedTab?.document.source == "手元の編集")
        session.requestOpen()
        #expect(session.fileNotice == nil)
        let openID = try #require(session.openRequest)
        session.reportOpenFailure("最新の読込エラー", request: openID)
        session.reportOpenFailure("古い読込エラー", request: UUID())
        #expect(session.fileNotice == "開けませんでした。最新の読込エラー")
    }
}

private actor CopyWriterProbe {
    struct Call: Equatable {
        let bytes: Data
        let encoding: SelectedTextFile.Encoding
        let url: URL
    }

    private var history: [Call] = []

    func record(_ source: String, _ encoding: SelectedTextFile.Encoding, _ url: URL) {
        history.append(Call(bytes: Data(source.utf8), encoding: encoding, url: url))
    }

    func calls() -> [Call] { history }
}
