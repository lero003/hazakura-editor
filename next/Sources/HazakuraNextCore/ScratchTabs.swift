import Foundation

/// One scratch window. The native editor owns the in-flight composition and undo history;
/// these documents retain the last committed text only.
public struct ScratchTabs {
    public struct Tab: Identifiable {
        public fileprivate(set) var document: ScratchDocument
        public let number: Int
        public let selectedFile: SelectedTextFile?
        let recoveryID: UUID?
        public var id: UUID { document.id }
        public var isReadOnly: Bool { selectedFile != nil }

        // A scratch tab remains edited even after undo returns to its starting text.
        var editedScratchRevision: UInt64? {
            let revision = document.revision
            return !isReadOnly && revision != 0 ? revision : nil
        }

        var recoveryDraft: RecoveryDraft? {
            guard let recoveryID, let revision = editedScratchRevision else { return nil }
            return RecoveryDraft(id: recoveryID, revision: revision, source: document.source)
        }
    }

    public struct DiscardTicket: Equatable {
        fileprivate let id: UUID
        fileprivate let revision: UInt64
    }

    public enum CloseResult: Equatable {
        case unavailable
        case closed
        case confirm(DiscardTicket)
    }

    // A scratch tab retains an entire native editor, including its undo history.
    public static let limit = 8

    public private(set) var tabs: [Tab]
    public private(set) var selectedID: UUID?
    public private(set) var isComposing = false
    private var nextNumber = 2

    public init(source: String) {
        let tab = Tab(document: ScratchDocument(source: source), number: 1, selectedFile: nil, recoveryID: UUID())
        tabs = [tab]
        selectedID = tab.id
    }

    public var selectedTab: Tab? { tabs.first { $0.id == selectedID } }
    public var canCreateTab: Bool { !isComposing && tabs.count < Self.limit }
    public var recoveryDrafts: [RecoveryDraft] { tabs.compactMap(\.recoveryDraft) }

    @discardableResult
    public mutating func newTab() -> UUID? {
        appendTab(ScratchDocument(source: ""), selectedFile: nil)
    }

    @discardableResult
    public mutating func openReadOnly(_ file: SelectedTextFile) -> UUID? {
        appendTab(ScratchDocument(source: file.source), selectedFile: file)
    }

    /// Opens an independent unsaved copy. The stored candidate is not consumed, reused or modified.
    @discardableResult
    public mutating func restoreDraft(_ draft: RecoveryDraft) -> UUID? {
        guard draft.revision > 0, draft.source.utf8.count <= RecoveryDraft.sourceByteLimit else { return nil }
        return appendTab(ScratchDocument(recoveredSource: draft.source), selectedFile: nil)
    }

    private mutating func appendTab(_ document: ScratchDocument, selectedFile: SelectedTextFile?) -> UUID? {
        guard canCreateTab else { return nil }
        let tab = Tab(document: document, number: nextNumber, selectedFile: selectedFile,
                      recoveryID: selectedFile == nil ? UUID() : nil)
        nextNumber += 1
        tabs.append(tab)
        selectedID = tab.id
        return tab.id
    }

    @discardableResult
    public mutating func select(_ id: UUID) -> Bool {
        guard !isComposing, tabs.contains(where: { $0.id == id }) else { return false }
        selectedID = id
        return true
    }

    /// Accepts only the final buffer from TextKit's committed-source callback, never marked text.
    /// AppKit can report that commit before its composition-end notification.
    @discardableResult
    public mutating func applyCommittedSource(_ source: String, to id: UUID) -> RecoveryDraft? {
        guard let index = tabs.firstIndex(where: { $0.id == id }), !tabs[index].isReadOnly else { return nil }
        let revision = tabs[index].document.revision
        tabs[index].document.replaceSource(source)
        guard revision != tabs[index].document.revision else { return nil }
        return tabs[index].recoveryDraft
    }

    public mutating func setComposing(_ composing: Bool, in id: UUID) {
        guard let tab = selectedTab, tab.id == id, !tab.isReadOnly else { return }
        isComposing = composing
    }

    public mutating func requestCloseSelected() -> CloseResult {
        guard !isComposing, let tab = selectedTab else { return .unavailable }
        if let revision = tab.editedScratchRevision {
            return .confirm(DiscardTicket(id: tab.id, revision: revision))
        }
        removeSelected()
        return .closed
    }

    public func draftForDiscard(_ ticket: DiscardTicket) -> RecoveryDraft? {
        guard !isComposing, let tab = selectedTab,
              tab.id == ticket.id, tab.editedScratchRevision == ticket.revision else { return nil }
        return tab.recoveryDraft
    }

    @discardableResult
    public mutating func discard(_ ticket: DiscardTicket) -> Bool {
        guard draftForDiscard(ticket) != nil else { return false }
        removeSelected()
        return true
    }

    private mutating func removeSelected() {
        guard let index = tabs.firstIndex(where: { $0.id == selectedID }) else { return }
        tabs.remove(at: index)
        selectedID = tabs.isEmpty ? nil : tabs[min(index, tabs.count - 1)].id
    }
}
