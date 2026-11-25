import AppKit
import Foundation
import HazakuraNextCore
import Observation

/// Shared by the editor view, menu actions and AppKit's close/quit delegates.
@MainActor @Observable
final class WorkspaceSession {
    @ObservationIgnored weak var window: NSWindow?
    var tabs: ScratchTabs
    var pendingDiscard: ScratchTabs.DiscardTicket?
    var openRequest: UUID?
    var exitNotice: String?

    init(source: String) {
        tabs = ScratchTabs(source: source)
    }

    var isBusy: Bool { pendingDiscard != nil || openRequest != nil }
    var canAddTab: Bool { !isBusy && tabs.canCreateTab }

    func requestOpen() {
        guard canAddTab else { return }
        openRequest = UUID()
    }

    func newTab() {
        guard canAddTab else { return }
        tabs.newTab()
    }
}
