@testable import HazakuraNext
import Testing

@MainActor
struct WorkspaceLModeTests {
    @Test func switchingLayoutDoesNotChangeTheSelectedDraftOrItsPreview() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let id = try #require(session.tabs.selectedID)
        let source = "# か\u{3099}\r\n\r\n本文 *強調* 👩‍💻"
        session.applyCommittedSource(source, to: id)
        let revision = try #require(session.tabs.selectedTab?.document.revision)
        let draft = try #require(session.tabs.recoveryDraft(for: id))

        #expect(session.isLMode == false)
        session.toggleLMode()
        #expect(session.isLMode)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(preview.source.utf8.elementsEqual(source.utf8))
        #expect(preview.documentID == id)
        #expect(preview.revision == revision)
        session.dismissMarkdownPreview(preview.id)
        session.toggleLMode()

        #expect(session.isLMode == false)
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDraft(for: id) == draft)
    }

    @Test func refusesToggleWhileComposingBusyOrWithoutADocument() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let id = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: id)
        #expect(session.canToggleLMode == false)
        session.toggleLMode()
        #expect(session.isLMode == false)

        session.tabs.setComposing(false, in: id)
        session.toggleLMode()
        #expect(session.isLMode)
        session.requestExport(.epub)
        let export = try #require(session.exportRequest)
        #expect(session.canToggleLMode == false)
        session.toggleLMode()
        #expect(session.isLMode)
        session.cancelExport(export.id)

        let result = session.tabs.requestCloseSelected()
        #expect(result == .closed)
        #expect(session.canToggleLMode == false)
        session.toggleLMode()
        #expect(session.isLMode)

        session.newTab()
        #expect(session.canToggleLMode)
        #expect(session.isLMode)
        #expect(WorkspaceSession(source: "# 別ウィンドウ").isLMode == false)
    }
}
