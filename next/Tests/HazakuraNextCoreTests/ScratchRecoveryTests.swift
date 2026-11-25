import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct ScratchRecoveryTests {
    @Test func reopensACommittedDraftWithoutConsumingItsRecoveryRecord() async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let parent = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let directory = parent.appending(path: "hazakura-recovery-\(UUID())", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: directory) }

        var firstWindow = ScratchTabs(source: "サンプル")
        let id = try #require(firstWindow.selectedID)
        let change = firstWindow.applyCommittedSource("# 復旧\r\nか\u{3099}", to: id)
        let savedDraft = try #require(change)
        try await DraftRecoveryStore(directory: directory).checkpoint(savedDraft)

        let reopenedStore = DraftRecoveryStore(directory: directory)
        let candidates = try await reopenedStore.drafts()
        let candidate = try #require(candidates.first)
        var nextWindow = ScratchTabs(source: "別のサンプル")
        let recoveredID = nextWindow.restoreDraft(candidate)
        #expect(recoveredID != nil)
        #expect(nextWindow.selectedTab?.document.source.utf8.elementsEqual(savedDraft.source.utf8) == true)
        #expect(try await reopenedStore.drafts() == [savedDraft])
    }

    @Test func checkpointProjectsOnlyCommittedChangesWithASteadyRecoveryID() throws {
        var tabs = ScratchTabs(source: "# 原稿")
        let documentID = try #require(tabs.selectedID)
        #expect(tabs.recoveryDrafts.isEmpty)
        tabs.setComposing(true, in: documentID)
        #expect(tabs.recoveryDrafts.isEmpty)

        // The native editor sends the committed buffer before it clears the composing flag.
        let firstChange = tabs.applyCommittedSource("# か\u{3099}\r\n", to: documentID)
        let first = try #require(firstChange)
        #expect(first.id != documentID)
        #expect(first.revision == 1)
        #expect(first.source.utf8.elementsEqual("# か\u{3099}\r\n".utf8))
        tabs.setComposing(false, in: documentID)
        let repeated = tabs.applyCommittedSource(first.source, to: documentID)
        #expect(repeated == nil)

        let replacement = tabs.applyCommittedSource("# が\r\n", to: documentID)
        let changed = try #require(replacement)
        #expect(changed.id == first.id)
        #expect(changed.revision == 2)
        #expect(changed.source.utf8.elementsEqual("# が\r\n".utf8))
        #expect(tabs.recoveryDrafts == [changed])
    }

    @Test func recoveredEmptySourceBecomesAnIndependentUnsavedTab() throws {
        var tabs = ScratchTabs(source: "サンプル")
        let prior = try #require(tabs.selectedID)
        let original = RecoveryDraft(id: UUID(), revision: .max, source: "")
        let restored = tabs.restoreDraft(original)
        let restoredID = try #require(restored)
        #expect(restoredID != prior)
        #expect(tabs.selectedID == restoredID)
        #expect(tabs.selectedTab?.selectedFile == nil)
        #expect(tabs.selectedTab?.document.source == "")
        let recoveredCopy = try #require(tabs.recoveryDrafts.first)
        #expect(recoveredCopy.id != original.id)
        #expect(recoveredCopy.revision == 1)
        #expect(recoveredCopy.source == "")
        let result = tabs.requestCloseSelected()
        guard case .confirm = result else {
            Issue.record("A restored draft requires explicit discard even if its source is empty.")
            return
        }
        #expect(tabs.tabs.count == 2)
    }

    @Test func restoreCannotEvictTabsOrInterruptMarkedInput() throws {
        var tabs = ScratchTabs(source: "既存の原稿")
        let prior = try #require(tabs.selectedID)
        let candidate = RecoveryDraft(id: UUID(), revision: 1, source: "前回の原稿")
        let invalid = RecoveryDraft(id: candidate.id, revision: 0, source: candidate.source)
        let refusedInvalidRecord = tabs.restoreDraft(invalid)
        #expect(refusedInvalidRecord == nil)
        let oversized = RecoveryDraft(id: UUID(), revision: 1, source: String(repeating: "予", count: 700_000))
        let refusedOversizedRecord = tabs.restoreDraft(oversized)
        #expect(refusedOversizedRecord == nil)
        tabs.setComposing(true, in: prior)
        let refusedWhileComposing = tabs.restoreDraft(candidate)
        #expect(refusedWhileComposing == nil)
        #expect(tabs.selectedID == prior)
        tabs.setComposing(false, in: prior)
        for _ in 1..<ScratchTabs.limit {
            tabs.newTab()
        }
        let previousSelection = tabs.selectedID
        let refusedAtLimit = tabs.restoreDraft(candidate)
        #expect(refusedAtLimit == nil)
        #expect(tabs.selectedID == previousSelection)
        #expect(tabs.tabs.count == ScratchTabs.limit)
        #expect(tabs.recoveryDrafts.isEmpty)
    }
}
