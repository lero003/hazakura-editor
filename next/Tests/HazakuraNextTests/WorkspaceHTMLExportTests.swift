import Darwin
@testable import HazakuraNext
import Foundation
import HazakuraNextCore
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceHTMLExportTests {
    private let destination = URL(fileURLWithPath: "/synthetic/export.html")

    @Test func exportsOnlyTheSelectedCommittedSnapshotWithoutChangingTheDraft() async throws {
        let probe = HTMLExportProbe()
        let recovery = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { await probe.recordCheckpoint($0) }, candidates: { [] },
            discardConfirmed: { _ in Issue.record("Export must not discard any recovery records.") }
        ))
        let session = WorkspaceSession(source: "# 選択していない原稿", recovery: recovery)
        session.newTab()
        let id = try #require(session.tabs.selectedID)
        let committed = "# か\u{3099}\r\n本文"
        session.applyCommittedSource(committed, to: id)
        let before = session.tabs.recoveryDrafts
        await recovery.waitForCurrentWorker()
        let html = "<!doctype html><h1>書き出し</h1>"
        let destination = self.destination

        #expect(session.canExportHTML)
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        #expect(session.isBusy)
        #expect(session.canEditSource == false)
        #expect(session.canExportHTML == false)
        session.requestOpen()
        session.requestSaveCopy()
        session.requestMarkdownPreview()
        session.requestRecovery()
        session.newTab()
        session.requestHTMLExport()
        #expect(session.openRequest == nil)
        #expect(session.saveCopyRequest == nil)
        #expect(session.markdownPreview == nil)
        #expect(session.showsRecovery == false)
        #expect(session.tabs.tabs.count == 2)
        #expect(session.htmlExportRequest?.id == request)
        #expect(session.reserveExitDiscard() == nil)
        if case .confirm(let ticket) = session.tabs.requestCloseSelected() {
            #expect(session.startTabDiscard(ticket) == nil)
        } else {
            Issue.record("The edited tab must require discard confirmation.")
        }

        await session.writeRequestedHTMLExport(request, to: destination, using: { source in
            await probe.recordSource(source)
            return html
        }, writer: { await probe.recordWrite($0, $1, $2) })

        #expect(await probe.sources == [Data(committed.utf8)])
        #expect(await probe.writes == [.init(bytes: Data(html.utf8), bom: false, destination: destination)])
        #expect(session.htmlExportRequest == nil)
        #expect(session.canEditSource)
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.selectedTab?.document.source.utf8.elementsEqual(committed.utf8) == true)
        #expect(session.tabs.recoveryDrafts == before)
        await recovery.waitForCurrentWorker()
        #expect(await probe.checkpoints == before)
        #expect(session.fileNotice?.contains("書き出しました") == true)
    }

    @Test func noRequestDuringCompositionOrAnotherOperationOrWithNoTab() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let id = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: id)
        #expect(session.canExportHTML == false)
        session.requestHTMLExport()
        #expect(session.htmlExportRequest == nil)
        session.tabs.setComposing(false, in: id)

        session.requestSaveCopy()
        let copy = try #require(session.saveCopyRequest?.id)
        session.requestHTMLExport()
        #expect(session.canExportHTML == false)
        #expect(session.htmlExportRequest == nil)
        session.cancelSaveCopy(copy)
        let closed = session.tabs.requestCloseSelected()
        #expect(closed == .closed)
        session.requestHTMLExport()
        #expect(session.canExportHTML == false)
        #expect(session.htmlExportRequest == nil)
    }

    @Test func aStalePickerCannotCancelOrExecuteANewerRequest() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestHTMLExport()
        let first = try #require(session.htmlExportRequest?.id)
        session.cancelHTMLExport(first)
        #expect(session.isBusy == false)
        session.requestHTMLExport()
        let second = try #require(session.htmlExportRequest?.id)
        #expect(first != second)

        session.cancelHTMLExport(first)
        await session.writeRequestedHTMLExport(first, to: destination, using: unexpectedRender, writer: unexpectedWrite)
        #expect(session.htmlExportRequest?.id == second)
        #expect(session.fileNotice == nil)
        session.cancelHTMLExport(second)
        #expect(session.isBusy == false)
    }

    enum SourceChange: CaseIterable, Sendable { case revision, tab, composition }

    @Test(arguments: SourceChange.allCases, [false, true])
    func staleSourceIsRejectedBeforeRenderAndAfterItsSuspension(_ change: SourceChange, _ whileRendering: Bool) async throws {
        let source = "# 原稿"
        let session = WorkspaceSession(source: source)
        session.newTab()
        let selected = try #require(session.tabs.selectedID)
        let other = try #require(session.tabs.tabs.first?.id)
        session.applyCommittedSource(source, to: selected)
        // Give both tabs the same revision; identity must be checked independently.
        session.applyCommittedSource("# 別の原稿", to: other)
        #expect(session.tabs.tabs.map(\.document.revision) == [1, 1])
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)

        func mutateSource() {
            switch change {
            case .revision:
                // Typing then undo still invalidates the captured committed revision.
                session.applyCommittedSource("# 変更", to: selected)
                session.applyCommittedSource(source, to: selected)
            case .tab:
                session.tabs.select(other)
            case .composition:
                session.tabs.setComposing(true, in: selected)
            }
        }

        if whileRendering {
            let suspension = ExportSuspension()
            defer { suspension.resume() }
            let task = Task { @MainActor in
                await session.writeRequestedHTMLExport(request, to: destination, using: { _ in
                    await suspension.pause()
                    return "<p>旧版</p>"
                }, writer: unexpectedWrite)
                suspension.resume()
            }
            await suspension.waitForPause()
            #expect(session.htmlExportRequest?.id == request)
            mutateSource()
            suspension.resume()
            await task.value
        } else {
            mutateSource()
            await session.writeRequestedHTMLExport(request, to: destination, using: unexpectedRender, writer: unexpectedWrite)
        }
        #expect(session.htmlExportRequest == nil)
        #expect(session.fileNotice?.contains("原稿") == true)
    }

    @Test func renderErrorFromAnObsoleteRevisionDoesNotReplaceTheStaleSourceNotice() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        let documentID = try #require(session.tabs.selectedID)
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        let suspension = ExportSuspension()
        defer { suspension.resume() }
        let task = Task { @MainActor in
            await session.writeRequestedHTMLExport(request, to: destination, using: { _ in
                await suspension.pause()
                throw MarkdownHTMLExport.ExportError.tooLarge
            }, writer: unexpectedWrite)
            suspension.resume()
        }
        await suspension.waitForPause()
        session.applyCommittedSource("# 更新後", to: documentID)
        suspension.resume()
        await task.value

        #expect(session.htmlExportRequest == nil)
        #expect(session.fileNotice?.contains("原稿の状態が変わった") == true)
        #expect(session.fileNotice?.contains("上限") == false)
    }

    @Test(arguments: [false, true])
    func cancellationBeforeWritingLeavesNoOutput(_ byTask: Bool) async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        let suspension = ExportSuspension()
        defer { suspension.resume() }
        let task = Task { @MainActor in
            await session.writeRequestedHTMLExport(request, to: destination, using: { _ in
                await suspension.pause()
                // Return a result even if cancellation was requested while suspended.
                return "<p>未確定</p>"
            }, writer: unexpectedWrite)
            suspension.resume()
        }
        await suspension.waitForPause()
        if byTask {
            task.cancel()
        } else {
            session.cancelHTMLExport(request)
            #expect(session.isBusy)
            session.requestHTMLExport()
            #expect(session.htmlExportRequest?.id == request)
        }
        suspension.resume()
        await task.value
        #expect(session.isBusy == false)
        #expect(session.fileNotice == nil)
    }

    @Test func reservesOneExecutorThroughRenderAndWriteAndKeepsSuccessAfterShipping() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        let render = ExportSuspension()
        let write = ExportSuspension()
        defer { render.resume(); write.resume() }
        let probe = HTMLExportProbe()
        let task = Task { @MainActor in
            await session.writeRequestedHTMLExport(request, to: destination, using: { source in
                await probe.recordSource(source)
                await render.pause()
                return "<p>確定</p>"
            }, writer: { source, bom, url in
                await probe.recordWrite(source, bom, url)
                // Model an already published file whose publisher has not returned yet.
                await write.pause()
            })
            render.resume()
            write.resume()
        }
        await render.waitForPause()
        #expect(session.isBusy)
        #expect(session.canEditSource == false)
        #expect(session.reserveExitDiscard() == nil)
        await session.writeRequestedHTMLExport(request, to: destination, using: unexpectedRender, writer: unexpectedWrite)
        render.resume()

        await write.waitForPause()
        #expect(session.isBusy)
        #expect(session.canEditSource == false)
        #expect(session.reserveExitDiscard() == nil)
        session.cancelHTMLExport(request)
        #expect(session.htmlExportRequest?.id == request)
        await session.writeRequestedHTMLExport(request, to: destination, using: unexpectedRender, writer: unexpectedWrite)
        task.cancel()
        write.resume()
        await task.value
        #expect(await probe.sources.count == 1)
        #expect(await probe.writes.count == 1)
        #expect(session.isBusy == false)
        #expect(session.fileNotice?.contains("書き出しました") == true)
    }

    @Test(arguments: ["/synthetic/export", "/synthetic/export.htm", "/synthetic/export.html.md", "/synthetic/export.html/"])
    func rejectsWrongOrMissingExtensionsWithoutSubstitutingAPath(_ path: String) async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        await session.writeRequestedHTMLExport(request, to: URL(fileURLWithPath: path),
                                               using: unexpectedRender, writer: unexpectedWrite)
        #expect(session.fileNotice?.contains(".html") == true)
        #expect(session.isBusy == false)
    }

    @Test func mapsRenderAndWriterErrorsWithoutDisclosingPaths() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        for failure in [MarkdownHTMLExport.ExportError.unavailable(.inputTooLarge), .tooLarge] {
            session.requestHTMLExport()
            let request = try #require(session.htmlExportRequest?.id)
            await session.writeRequestedHTMLExport(request, to: destination, using: { _ in throw failure }, writer: unexpectedWrite)
            #expect(session.fileNotice?.contains("上限") == true)
            #expect(session.isBusy == false)
        }
        session.requestHTMLExport()
        let request = try #require(session.htmlExportRequest?.id)
        let privatePath = "/synthetic/private/example.html"
        await session.writeRequestedHTMLExport(request, to: URL(fileURLWithPath: privatePath), using: { _ in "<p>確定</p>" }, writer: { _, _, _ in
            throw NSError(domain: NSCocoaErrorDomain, code: NSFileWriteUnknownError, userInfo: [NSFilePathErrorKey: privatePath])
        })
        let notice = try #require(session.fileNotice)
        #expect(notice.contains("書き出せませんでした"))
        #expect(notice.contains(privatePath) == false)
        #expect(notice.contains("example.html") == false)
        #expect(session.canExportHTML)
    }

    @Test func realWriterExportsTheOpenedSnapshotAndRefusesExistingOrLinkedDestinations() async throws {
        let real = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(real)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-html-workspace-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let opened = folder.appending(path: "original.html")
        let exported = folder.appending(path: "export.html")
        let linked = folder.appending(path: "link.html")
        let initial = Data("\u{FEFF}# 開いた時点\r\n\r\n確定原文".utf8)
        try initial.write(to: opened)
        let snapshot = try await SelectedTextFile.read(from: opened)
        let session = WorkspaceSession(source: "# 非選択")
        let openedID = session.tabs.openReadOnly(snapshot)
        let readOnly = try #require(openedID)
        let external = Data("# 外部の更新".utf8)
        try external.write(to: opened, options: .atomic)
        try FileManager.default.createSymbolicLink(at: linked, withDestinationURL: opened)

        for item in [opened, linked, exported] {
            #expect(session.canExportHTML)
            session.requestHTMLExport()
            let request = try #require(session.htmlExportRequest?.id)
            await session.writeRequestedHTMLExport(request, to: item)
            if item != exported {
                #expect(session.fileNotice?.contains("既に") == true)
                #expect(try Data(contentsOf: opened) == external)
            }
        }
        let contents = try Data(contentsOf: exported)
        let html = String(decoding: contents, as: UTF8.self)
        #expect(html.contains("開いた時点"))
        #expect(html.contains("確定原文"))
        #expect(html.contains("外部の更新") == false)
        #expect(html.contains("非選択") == false)
        #expect(contents.starts(with: [0xEF, 0xBB, 0xBF]) == false)

        let sentinel = Data("existing destination".utf8)
        try sentinel.write(to: exported)
        session.requestHTMLExport()
        let retry = try #require(session.htmlExportRequest?.id)
        await session.writeRequestedHTMLExport(retry, to: exported)
        #expect(session.fileNotice?.contains("既に") == true)
        #expect(try Data(contentsOf: exported) == sentinel)
        #expect(try Data(contentsOf: opened) == external)
        #expect(session.tabs.selectedID == readOnly)
        #expect(session.tabs.selectedTab?.selectedFile?.originalBytes == initial)
        #expect(session.tabs.recoveryDrafts.isEmpty)
    }
}

private func unexpectedRender(_ source: String) async throws -> String {
    Issue.record("The renderer must not be invoked.")
    throw CancellationError()
}

private func unexpectedWrite(_ html: String, _ bom: Bool, _ url: URL) async throws {
    Issue.record("The writer must not be invoked.")
}

private actor HTMLExportProbe {
    struct Write: Equatable {
        let bytes: Data
        let bom: Bool
        let destination: URL
    }

    private(set) var sources: [Data] = []
    private(set) var writes: [Write] = []
    private(set) var checkpoints: [RecoveryDraft] = []

    func recordSource(_ source: String) { sources.append(Data(source.utf8)) }
    func recordCheckpoint(_ draft: RecoveryDraft) { checkpoints.append(draft) }

    func recordWrite(_ html: String, _ bom: Bool, _ destination: URL) {
        writes.append(Write(bytes: Data(html.utf8), bom: bom, destination: destination))
    }
}

private struct ExportSuspension: Sendable {
    private let began = AsyncStream<Void>.makeStream()
    private let unblock = AsyncStream<Void>.makeStream()

    func pause() async {
        began.continuation.finish()
        for await _ in unblock.stream {}
    }

    func waitForPause() async { for await _ in began.stream {} }

    func resume() {
        began.continuation.finish()
        unblock.continuation.finish()
    }
}
