import Foundation

/// One scratch window. The native editor owns the in-flight composition and undo history;
/// these documents retain the last committed text only.
public struct ScratchTabs {
    public struct Tab: Identifiable {
        public fileprivate(set) var document: ScratchDocument
        public let number: Int
        public var id: UUID { document.id }
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
        let tab = Tab(document: ScratchDocument(source: source), number: 1)
        tabs = [tab]
        selectedID = tab.id
    }

    public var selectedTab: Tab? { tabs.first { $0.id == selectedID } }
    public var canCreateTab: Bool { !isComposing && tabs.count < Self.limit }

    @discardableResult
    public mutating func newTab() -> UUID? {
        guard canCreateTab else { return nil }
        let tab = Tab(document: ScratchDocument(source: ""), number: nextNumber)
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

    public mutating func applyCommittedSource(_ source: String, to id: UUID) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs[index].document.replaceSource(source)
    }

    public mutating func setComposing(_ composing: Bool, in id: UUID) {
        guard selectedID == id else { return }
        isComposing = composing
    }

    public mutating func requestCloseSelected() -> CloseResult {
        guard !isComposing, let tab = selectedTab else { return .unavailable }
        if tab.document.revision != 0 {
            return .confirm(DiscardTicket(id: tab.id, revision: tab.document.revision))
        }
        removeSelected()
        return .closed
    }

    @discardableResult
    public mutating func discard(_ ticket: DiscardTicket) -> Bool {
        guard !isComposing, let tab = selectedTab,
              tab.id == ticket.id, tab.document.revision == ticket.revision else { return false }
        removeSelected()
        return true
    }

    private mutating func removeSelected() {
        guard let index = tabs.firstIndex(where: { $0.id == selectedID }) else { return }
        tabs.remove(at: index)
        selectedID = tabs.isEmpty ? nil : tabs[min(index, tabs.count - 1)].id
    }
}
