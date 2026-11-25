import HazakuraNextCore
import Testing

struct ScratchTabsTests {
    @Test func editsAndSelectionAreBoundToIndividualDocumentIDs() throws {
        var tabs = ScratchTabs(source: "# 元の原稿")
        let first = try #require(tabs.selectedID)
        let newID = tabs.newTab()
        let second = try #require(newID)
        #expect(first != second)
        #expect(tabs.selectedID == second)

        tabs.applyCommittedSource("# 二つ目", to: second)
        // A callback belongs to its originating document, not to the current selection.
        tabs.applyCommittedSource("# 一つ目", to: first)
        let selectedFirst = tabs.select(first)
        #expect(selectedFirst)
        #expect(tabs.selectedTab?.document.source == "# 一つ目")
        let selectedSecond = tabs.select(second)
        #expect(selectedSecond)
        #expect(tabs.selectedTab?.document.source == "# 二つ目")
    }

    @Test func compositionBlocksTabCommandsUntilItEnds() throws {
        var tabs = ScratchTabs(source: "# 元の原稿")
        let first = try #require(tabs.selectedID)
        let newID = tabs.newTab()
        let second = try #require(newID)
        let selectedFirst = tabs.select(first)
        #expect(selectedFirst)
        // An inactive editor cannot place a lock on the active document.
        tabs.setComposing(true, in: second)
        #expect(tabs.isComposing == false)
        tabs.setComposing(true, in: first)
        #expect(tabs.selectedTab?.document.source == "# 元の原稿")
        let addedWhileComposing = tabs.newTab()
        let switchedWhileComposing = tabs.select(second)
        let closedWhileComposing = tabs.requestCloseSelected()
        #expect(addedWhileComposing == nil)
        #expect(switchedWhileComposing == false)
        #expect(closedWhileComposing == .unavailable)

        tabs.applyCommittedSource("# 確定", to: first)
        tabs.setComposing(false, in: first)
        #expect(tabs.selectedTab?.document.source == "# 確定")
        let selectedSecond = tabs.select(second)
        #expect(selectedSecond)
    }

    @Test func staleDiscardCannotRemoveARevisedOrDifferentDocument() throws {
        var tabs = ScratchTabs(source: "最初")
        let first = try #require(tabs.selectedID)
        tabs.applyCommittedSource("編集中", to: first)
        guard case let .confirm(ticket) = tabs.requestCloseSelected() else {
            Issue.record("Expected confirmation for an edited scratch document")
            return
        }
        let newID = tabs.newTab()
        let second = try #require(newID)
        let discardedOther = tabs.discard(ticket)
        #expect(discardedOther == false)
        #expect(tabs.selectedID == second)

        let selectedFirst = tabs.select(first)
        #expect(selectedFirst)
        tabs.applyCommittedSource("さらに編集", to: first)
        let discardedRevised = tabs.discard(ticket)
        #expect(discardedRevised == false)
        guard case let .confirm(current) = tabs.requestCloseSelected() else {
            Issue.record("Expected a new confirmation")
            return
        }
        let discarded = tabs.discard(current)
        #expect(discarded)
        #expect(tabs.selectedID == second)
        tabs.applyCommittedSource("遅延した通知", to: first)
        #expect(tabs.tabs.map(\.id) == [second])
        #expect(tabs.selectedTab?.document.source == "")
    }

    @Test func closingUneditedTabIsImmediateAndAllTabsCanBeReopenedFromEmptyState() throws {
        var tabs = ScratchTabs(source: "元の原稿")
        let original = try #require(tabs.selectedID)
        let closed = tabs.requestCloseSelected()
        #expect(closed == .closed)
        #expect(tabs.selectedID == nil)
        let selectedClosed = tabs.select(original)
        #expect(selectedClosed == false)
        let newID = tabs.newTab()
        let reopened = try #require(newID)
        #expect(reopened != original)
        #expect(tabs.selectedID == reopened)
        #expect(tabs.selectedTab?.document.source == "")
    }

    @Test func scratchWindowCapsEditorCount() {
        var tabs = ScratchTabs(source: "")
        for _ in 1..<ScratchTabs.limit {
            let added = tabs.newTab()
            #expect(added != nil)
        }
        let selection = tabs.selectedID
        let overflow = tabs.newTab()
        #expect(overflow == nil)
        #expect(tabs.selectedID == selection)
        #expect(tabs.tabs.count == ScratchTabs.limit)
    }
}
