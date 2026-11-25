import Foundation
import HazakuraNextCore
import Testing

struct WindowExitGateTests {
    @Test func cleanOrEmptyWindowAllowsEitherDestination() {
        var tabs = ScratchTabs(source: "内蔵サンプル")
        var gate = WindowExitGate()

        let close = gate.request(.window, tabs: tabs, busy: false)
        let quit = gate.request(.application, tabs: tabs, busy: false)
        let closeTab = tabs.requestCloseSelected()
        let closeEmpty = gate.request(.window, tabs: tabs, busy: false)
        #expect(close == .allow)
        #expect(quit == .allow)
        #expect(closeTab == .closed)
        #expect(closeEmpty == .allow)
    }

    @Test func busyAndCompositionBlockEvenCleanTabs() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        var gate = WindowExitGate()

        let closeWhileBusy = gate.request(.window, tabs: tabs, busy: true)
        tabs.setComposing(true, in: id)
        let quitDuringComposition = gate.request(.application, tabs: tabs, busy: false)
        tabs.setComposing(false, in: id)
        let quitAfterComposition = gate.request(.application, tabs: tabs, busy: false)
        #expect(closeWhileBusy == .blocked(.busy))
        #expect(quitDuringComposition == .blocked(.composing))
        #expect(quitAfterComposition == .allow)
    }

    @Test func countsAllEditedScratchTabsEvenAfterUndoAndNeverDiscardsThem() throws {
        var tabs = ScratchTabs(source: "元の原稿")
        let first = try #require(tabs.selectedID)
        tabs.applyCommittedSource("追記", to: first)
        tabs.applyCommittedSource("元の原稿", to: first)
        let second = try addTab(to: &tabs)
        tabs.applyCommittedSource("別の原稿", to: second)
        _ = try addTab(to: &tabs)
        var gate = WindowExitGate()

        let ticket = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))
        #expect(ticket.destination == .window)
        #expect(ticket.count == 2)
        let accepted = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        let replayed = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(accepted)
        #expect(replayed == false)
        #expect(tabs.tabs.map(\.document.source) == ["元の原稿", "別の原稿", ""])
    }

    @Test func selectionAndCleanTabChangesDoNotInvalidateConsent() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.application, tabs: tabs, busy: false))

        let clean = try addTab(to: &tabs)
        #expect(tabs.selectedID == clean)
        let accepted = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(accepted)
    }

    @Test func aNewlyEditedTabInvalidatesConsent() throws {
        var tabs = ScratchTabs(source: "")
        let first = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: first)
        let second = try addTab(to: &tabs)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.application, tabs: tabs, busy: false))

        tabs.applyCommittedSource("追加の原稿", to: second)
        let accepted = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(accepted == false)
    }

    @Test func staleRevisionOfAnInactiveTabRejectsConsentAndConsumesTicket() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        _ = try addTab(to: &tabs)
        let beforeEdit = tabs
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))

        tabs.applyCommittedSource("さらに編集", to: id)
        let stale = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        let replayed = gate.resolve(ticket, discard: true, tabs: beforeEdit, busy: false)
        #expect(stale == false)
        #expect(replayed == false)
        let retry = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))
        let accepted = gate.resolve(retry, discard: true, tabs: tabs, busy: false)
        #expect(accepted)
    }

    @Test func sameCountAndRevisionWithReplacementIDRejectsConsent() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))

        guard case let .confirm(tabTicket) = tabs.requestCloseSelected() else {
            Issue.record("Expected confirmation for removing the edited tab")
            return
        }
        let discardedTab = tabs.discard(tabTicket)
        try #require(discardedTab)
        let replacement = try addTab(to: &tabs)
        tabs.applyCommittedSource("下書き", to: replacement)
        let accepted = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(accepted == false)
    }

    @Test func pendingPromptBlocksReentryAndCancellationRequiresFreshTicket() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))

        let closeAgain = gate.request(.window, tabs: tabs, busy: false)
        let quit = gate.request(.application, tabs: tabs, busy: false)
        let canceled = gate.resolve(ticket, discard: false, tabs: tabs, busy: false)
        #expect(closeAgain == .blocked(.busy))
        #expect(quit == .blocked(.busy))
        #expect(canceled == false)
        #expect(tabs.selectedTab?.document.source == "下書き")

        let fresh = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))
        #expect(fresh != ticket)
        let replayed = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        let accepted = gate.resolve(fresh, discard: true, tabs: tabs, busy: false)
        #expect(replayed == false)
        #expect(accepted)
    }

    @Test(arguments: [true, false])
    func consentCannotBeReplayedAfterBusyOrCompositionClears(_ busy: Bool) throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.application, tabs: tabs, busy: false))

        if !busy { tabs.setComposing(true, in: id) }
        let blocked = gate.resolve(ticket, discard: true, tabs: tabs, busy: busy)
        tabs.setComposing(false, in: id)
        let replayed = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(blocked == false)
        #expect(replayed == false)
        let retry = try confirmation(from: gate.request(.application, tabs: tabs, busy: false))
        let accepted = gate.resolve(retry, discard: true, tabs: tabs, busy: false)
        #expect(accepted)
    }

    @Test func alteredDestinationOrCountDoesNotAuthorizeOrConsumeTicket() throws {
        var tabs = ScratchTabs(source: "")
        let id = try #require(tabs.selectedID)
        tabs.applyCommittedSource("下書き", to: id)
        var gate = WindowExitGate()
        let ticket = try confirmation(from: gate.request(.window, tabs: tabs, busy: false))
        var alteredDestination = ticket
        alteredDestination.destination = .application
        var alteredCount = ticket
        alteredCount.count += 1

        let wrongDestination = gate.resolve(alteredDestination, discard: true, tabs: tabs, busy: false)
        let wrongCount = gate.resolve(alteredCount, discard: true, tabs: tabs, busy: false)
        let closeAccepted = gate.resolve(ticket, discard: true, tabs: tabs, busy: false)
        #expect(wrongDestination == false)
        #expect(wrongCount == false)
        #expect(closeAccepted)

        let application = try confirmation(from: gate.request(.application, tabs: tabs, busy: false))
        #expect(application.destination == .application)
        let wrongTicket = gate.resolve(ticket, discard: false, tabs: tabs, busy: false)
        let quitAccepted = gate.resolve(application, discard: true, tabs: tabs, busy: false)
        #expect(wrongTicket == false)
        #expect(quitAccepted)
    }

    private func addTab(to tabs: inout ScratchTabs, sourceLocation: SourceLocation = #_sourceLocation) throws -> UUID {
        let id = tabs.newTab()
        return try #require(id, sourceLocation: sourceLocation)
    }

    private func confirmation(
        from decision: WindowExitGate.Decision,
        sourceLocation: SourceLocation = #_sourceLocation
    ) throws -> WindowExitGate.Ticket {
        let ticket: WindowExitGate.Ticket? = if case let .confirm(ticket) = decision { ticket } else { nil }
        return try #require(ticket, "Expected confirmation, got \(decision)", sourceLocation: sourceLocation)
    }
}
