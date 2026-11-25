import Foundation

/// Decides whether one scratch window can exit. The caller owns presenting confirmation
/// and dispatching the approved close or quit; the gate never changes the tabs.
public struct WindowExitGate {
    public init() {}

    public enum Destination: Equatable {
        case window, application
    }

    public enum Decision: Equatable {
        case allow
        case blocked(BlockReason)
        case confirm(Ticket)
    }

    public enum BlockReason: Equatable {
        case composing, busy
    }

    public struct Ticket: Equatable {
        public var destination: Destination
        public var count: Int
        fileprivate let editedRevisions: [UUID: UInt64]
        fileprivate let nonce: UUID
    }

    private var pending: Ticket?

    public mutating func request(_ destination: Destination, tabs: ScratchTabs, busy: Bool) -> Decision {
        guard !busy, pending == nil else { return .blocked(.busy) }
        guard !tabs.isComposing else { return .blocked(.composing) }
        let revisions = Self.editedScratchRevisions(in: tabs)
        guard !revisions.isEmpty else { return .allow }

        let ticket = Ticket(destination: destination, count: revisions.count, editedRevisions: revisions, nonce: UUID())
        pending = ticket
        return .confirm(ticket)
    }

    /// Only the current ticket is consumed, even if its response is canceled or no longer safe.
    public mutating func resolve(_ ticket: Ticket, discard: Bool, tabs: ScratchTabs, busy: Bool) -> Bool {
        guard pending == ticket else { return false }
        pending = nil
        guard discard, !busy, !tabs.isComposing else { return false }
        return ticket.editedRevisions == Self.editedScratchRevisions(in: tabs)
    }

    private static func editedScratchRevisions(in tabs: ScratchTabs) -> [UUID: UInt64] {
        var revisions: [UUID: UInt64] = [:]
        for tab in tabs.tabs {
            if let revision = tab.editedScratchRevision {
                revisions[tab.id] = revision
            }
        }
        return revisions
    }
}
