import Darwin
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceEPUBExportTests {
    @Test func createsOnlyANewEPUBFromTheCommittedSelection() async throws {
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-epub-workspace-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false,
                                                attributes: [.posixPermissions: 0o700])
        defer { try? FileManager.default.removeItem(at: folder) }
        let destination = folder.appending(path: "原稿.EPUB")
        let original = folder.appending(path: "原本.md")
        let committed = "# 一章\r\n\r\n## 二章\r\n\r\n末尾の本文"
        try Data(committed.utf8).write(to: original)
        let selected = try await SelectedTextFile.read(from: original)
        let session = WorkspaceSession(source: "# 選択していない原稿")
        let opened = session.tabs.openReadOnly(selected)
        let documentID = try #require(opened)
        let revision = try #require(session.tabs.selectedTab?.document.revision)

        session.requestExport(.epub)
        let first = try #require(session.exportRequest)
        session.requestExport(.pdf)
        #expect(session.exportRequest?.id == first.id)
        #expect(session.exportRequest?.format == .epub)
        await session.writeRequestedExport(first.id, to: destination)

        let bytes = try Data(contentsOf: destination)
        #expect(EPUBStoredArchive.hasMimetypePrefix(bytes))
        #expect(String(decoding: bytes, as: UTF8.self).contains("末尾の本文"))
        #expect(String(decoding: bytes, as: UTF8.self).contains("選択していない原稿") == false)
        #expect(session.fileNotice?.contains("EPUBを書き出しました") == true)

        session.requestExport(.epub)
        let retry = try #require(session.exportRequest)
        await session.writeRequestedExport(retry.id, to: destination)
        #expect(session.fileNotice?.contains("既に") == true)
        #expect(try Data(contentsOf: destination) == bytes)
        #expect(try Data(contentsOf: original) == Data(committed.utf8))
        #expect(session.tabs.selectedID == documentID)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDrafts.isEmpty)
        #expect(session.canExport)
    }

    @Test func aPDFPathIsRejectedBeforeGeneratingEPUB() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestExport(.epub)
        let id = try #require(session.exportRequest?.id)
        let destination = URL(fileURLWithPath: "/synthetic/export.pdf")
        await session.writeRequestedExport(id, to: destination, using: .init(renderEPUB: { _ in
            Issue.record("A mismatched extension cannot start EPUB generation.")
            throw CancellationError()
        }, writeEPUB: { _, _ in Issue.record("A mismatched extension cannot reach the writer.") }))
        #expect(session.fileNotice?.contains(".epub") == true)
        #expect(session.exportRequest == nil)
    }

    @Test func aLateArchiveCannotWriteAfterTheDraftChanges() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        let documentID = try #require(session.tabs.selectedID)
        session.requestExport(.epub)
        let request = try #require(session.exportRequest?.id)
        let destination = URL(fileURLWithPath: "/synthetic/export.epub")
        let suspension = ExportSuspension()
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                await session.writeRequestedExport(request, to: destination, using: .init(renderEPUB: { _ in
                    await suspension.pause()
                    return Data()
                }, writeEPUB: { _, _ in Issue.record("An obsolete EPUB must not reach the writer.") }))
                suspension.resume()
            }
            await suspension.waitForPause()
            session.applyCommittedSource("# 新しい原稿", to: documentID)
            suspension.resume()
        }

        #expect(session.exportRequest == nil)
        #expect(session.fileNotice?.contains("原稿の状態が変わったため、EPUBを書き出していません") == true)
        #expect(session.tabs.selectedTab?.document.source == "# 新しい原稿")
    }
}
