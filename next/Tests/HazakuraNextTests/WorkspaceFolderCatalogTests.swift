import Darwin
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceFolderCatalogTests {
    @Test func reservesOnlyOneRequestAndShowsNamesWithoutChangingTheDraft() async throws {
        let session = WorkspaceSession(source: "サンプル")
        let selected = try #require(session.tabs.selectedID)
        session.applyCommittedSource("未保存の原稿\r\n", to: selected)
        let originalDrafts = session.tabs.recoveryDrafts
        session.requestFolderCatalog()
        let id = try #require(session.folderCatalogRequest)
        #expect(session.isBusy)
        #expect(session.canEditSource == false)
        session.requestOpen()
        session.requestFolderCatalog()
        #expect(session.openRequest == nil)
        #expect(session.folderCatalogRequest == id)
        let catalog = try await fixtureCatalog()
        await session.readFolderCatalog(id) { catalog }
        let report = try #require(session.folderCatalogReport)
        #expect(report.id == id)
        #expect(report.catalog.names == catalog.names)
        #expect(session.folderCatalogRequest == nil)
        #expect(session.isBusy)
        session.dismissFolderCatalogReport(.init())
        #expect(session.folderCatalogReport?.id == id)
        session.dismissFolderCatalogReport(id)
        #expect(session.isBusy == false)
        #expect(session.tabs.selectedID == selected)
        #expect(session.tabs.recoveryDrafts == originalDrafts)
        #expect(session.canEditSource)
    }

    @Test func initialAndLateCompositionDoNotPresentTheCatalog() async throws {
        let session = WorkspaceSession(source: "サンプル")
        let selected = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: selected)
        session.requestFolderCatalog()
        #expect(session.folderCatalogRequest == nil)
        session.tabs.setComposing(false, in: selected)
        session.requestFolderCatalog()
        let id = try #require(session.folderCatalogRequest)
        let catalog = try await fixtureCatalog()
        await session.readFolderCatalog(id) {
            session.tabs.setComposing(true, in: selected)
            return catalog
        }
        #expect(session.folderCatalogReport == nil)
        #expect(session.folderCatalogRequest == nil)
    }

    @Test func cancellingThePickerOrReadDoesNotPublishAndCannotStartAnotherReadInFlight() async throws {
        let session = WorkspaceSession(source: "サンプル")
        session.requestFolderCatalog()
        let dismissed = try #require(session.folderCatalogRequest)
        await session.readFolderCatalog(dismissed) { nil }
        #expect(session.folderCatalogReport == nil)
        #expect(session.fileNotice == nil)
        session.requestFolderCatalog()
        let id = try #require(session.folderCatalogRequest)
        await session.readFolderCatalog(dismissed) {
            Issue.record("A stale task must not open another picker.")
            return nil
        }
        let catalog = try await fixtureCatalog()
        await session.readFolderCatalog(id) {
            session.cancelFolderCatalog(id)
            #expect(session.isBusy)
            session.requestFolderCatalog()
            #expect(session.folderCatalogRequest == nil)
            return catalog
        }
        #expect(session.folderCatalogReport == nil)
        #expect(session.isBusy == false)
    }

    @Test func explicitOpenReadsOnlyOneListedEntryAndRetainsTheDraft() async throws {
        try await withFixture { folder, catalog in
            let session = WorkspaceSession(source: "初期原稿")
            let draftID = try #require(session.tabs.selectedID)
            session.applyCommittedSource("変更した原稿", to: draftID)
            let drafts = session.tabs.recoveryDrafts
            session.requestFolderCatalog()
            let id = try #require(session.folderCatalogRequest)
            await session.readFolderCatalog(id) { catalog }
            let entry = try #require(catalog.entries.first { $0.name == "原稿.md" })
            #expect(session.prepareFolderEntry(reportID: UUID(), entryID: entry.id) == false)
            #expect(session.prepareFolderEntry(reportID: id, entryID: Data("他の原稿.md".utf8)) == false)
            let prepared = session.prepareFolderEntry(reportID: id, entryID: entry.id)
            #expect(prepared)
            let request = try #require(session.folderEntryOpening)
            #expect(session.folderCatalogReport == nil)
            #expect(session.isBusy)
            await session.readPreparedFolderEntry(request.id) { _ in
                Issue.record("Staging an entry must not start the OS picker or read.")
                return nil
            }
            session.startOpeningFolderEntry(request.id)
            await session.readPreparedFolderEntry(request.id) { opening in
                #expect(opening.entry.id == entry.id)
                await session.readPreparedFolderEntry(opening.id) { _ in
                    Issue.record("A running request must not be read twice.")
                    return nil
                }
                return try await opening.catalog.readEntry(opening.entry.id, from: folder)
            }
            #expect(session.folderEntryOpening == nil)
            #expect(session.isBusy == false)
            #expect(session.tabs.tabs.count == 2)
            #expect(session.tabs.selectedTab?.isReadOnly == true)
            #expect(session.tabs.selectedTab?.document.source == "# 原稿\r\n")
            #expect(session.tabs.recoveryDrafts == drafts)
            #expect(session.tabs.tabs.first?.id == draftID)
        }
    }

    @Test(arguments: [false, true])
    func cancelOrLateCompositionDiscardsTheOpenedSnapshot(_ cancel: Bool) async throws {
        try await withFixture { folder, catalog in
            let session = WorkspaceSession(source: "左の原稿")
            let draftID = try #require(session.tabs.selectedID)
            session.requestFolderCatalog()
            let id = try #require(session.folderCatalogRequest)
            await session.readFolderCatalog(id) { catalog }
            let entry = try #require(catalog.entries.first)
            let prepared = session.prepareFolderEntry(reportID: id, entryID: entry.id)
            try #require(prepared)
            let request = try #require(session.folderEntryOpening)
            session.startOpeningFolderEntry(request.id)
            await session.readPreparedFolderEntry(request.id) { opening in
                let file = try await opening.catalog.readEntry(opening.entry.id, from: folder)
                if cancel {
                    session.cancelFolderEntry(opening.id)
                    #expect(session.isBusy)
                    session.requestOpen()
                    #expect(session.openRequest == nil)
                } else {
                    session.tabs.setComposing(true, in: draftID)
                }
                return file
            }
            #expect(session.folderEntryOpening == nil)
            #expect(session.isBusy == false)
            #expect(session.tabs.selectedID == draftID)
            #expect(session.tabs.tabs.count == 1)
        }
    }

    @Test func aLateFailureAfterClearingTheWindowDoesNotReplaceTheNoticeOrOpenATab() async throws {
        let catalog = try await fixtureCatalog()
        let session = WorkspaceSession(source: "原稿")
        session.requestFolderCatalog()
        let listID = try #require(session.folderCatalogRequest)
        await session.readFolderCatalog(listID) { catalog }
        let entry = try #require(catalog.entries.first)
        let prepared = session.prepareFolderEntry(reportID: listID, entryID: entry.id)
        try #require(prepared)
        let id = try #require(session.folderEntryOpening?.id)
        session.startOpeningFolderEntry(id)
        await session.readPreparedFolderEntry(id) { _ in
            session.clearFolderCatalog()
            throw SelectedFolderCatalog.ScanError.selectionChanged
        }
        #expect(session.tabs.tabs.count == 1)
        #expect(session.fileNotice == nil)
        #expect(session.folderEntryOpening == nil)
        #expect(session.isBusy == false)
    }

    @Test func fullTabsOrExpiredReportsDoNotPrepareAnOpen() async throws {
        let catalog = try await fixtureCatalog()
        let session = WorkspaceSession(source: "初期原稿")
        for _ in 1..<ScratchTabs.limit { session.newTab() }
        #expect(session.tabs.canCreateTab == false)
        session.requestFolderCatalog()
        let id = try #require(session.folderCatalogRequest)
        await session.readFolderCatalog(id) { catalog }
        let entry = try #require(catalog.entries.first)
        #expect(session.prepareFolderEntry(reportID: id, entryID: entry.id) == false)
        session.dismissFolderCatalogReport(id)
        #expect(session.prepareFolderEntry(reportID: id, entryID: entry.id) == false)
        #expect(session.folderEntryOpening == nil)
    }

    @Test func scanFailureUsesFixedMessagesWithoutRetainingTheRequest() async throws {
        let session = WorkspaceSession(source: "サンプル")
        session.requestFolderCatalog()
        let id = try #require(session.folderCatalogRequest)
        await session.readFolderCatalog(id) { throw SelectedFolderCatalog.ScanError.tooManyEntries }
        #expect(session.folderCatalogReport == nil)
        #expect(session.folderCatalogRequest == nil)
        #expect(session.fileNotice?.contains("512") == true)
        #expect(session.isBusy == false)
    }

    private func fixtureCatalog() async throws -> SelectedFolderCatalog {
        try await withFixture { _, catalog in catalog }
    }

    private func withFixture<Result>(
        _ body: (URL, SelectedFolderCatalog) async throws -> Result
    ) async throws -> Result {
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-workspace-catalog-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        try Data("# 原稿\r\n".utf8).write(to: folder.appending(path: "原稿.md"))
        try Data([0, 0, 0]).write(to: folder.appending(path: "補足.txt"))
        return try await body(folder, SelectedFolderCatalog.read(from: folder))
    }
}
