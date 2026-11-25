@testable import HazakuraNext
@testable import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceFolderCatalogTests {
    private let catalog = SelectedFolderCatalog(folderName: "合成フォルダ", names: ["原稿.md", "補足.txt"])

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
}
